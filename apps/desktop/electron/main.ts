import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
// 先加载 .env（优先根目录，其次 apps/desktop），不覆盖已存在的进程变量
try {
  const ROOT_ENV = path.resolve(__dirname, '../../..', '.env');
  dotenv.config({ path: ROOT_ENV, override: false });
  const APP_ENV = path.resolve(__dirname, '..', '.env');
  dotenv.config({ path: APP_ENV, override: false });
} catch { /* noop */ }

// MCP：主进程最小客户端接口
import { McpSessionManager } from './mcp/sessionManager';
import type { SessionSpec, SessionHandle } from './mcp/sessionManager';
// LLM：最小接入（仅在主进程验证流式输出）
import { runReactAgent } from './llm/reactAgentRunner';
import { startReactAgentStream } from './llm/reactAgentStream';
import type { LLMMessage } from './llm/types';
import { disposeMcpRuntime } from './llm/mcp/runtime';

// 中文注释：创建应用主窗口（自定义标题栏，渲染器使用 Vite）
let mainWindow: BrowserWindow | null = null;

type ReactAgentPayload = {
  messages: LLMMessage[];
  threadId?: string;
};


function getPlatformTag(): 'windows' | 'mac' | 'linux' {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'mac';
    default:
      return 'linux';
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      // 中文注释：tsc 编译后预加载脚本输出为 dist/preload.js
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
    },
  });
  
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, 'index.html');
    await mainWindow.loadFile(indexHtml);
  }

  // 安全：用系统浏览器打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch { /* noop */ }
    return { action: 'deny' };
  });

  // 将窗口尺寸变化事件转发给渲染器（用于更新最大化图标）
  mainWindow.on('resize', () => {
    try { mainWindow?.webContents.send('window:resized'); } catch { /* noop */ }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 统一资源清理：在应用退出前释放 MCP Runtime（LangChain mcp-adapters 侧连接/子进程）
app.on('before-quit', async () => {
  try { await disposeMcpRuntime(); } catch { /* noop */ }
});

app.whenReady().then(async () => {
  // MCP：会话管理器（最小实现，不连接 UI 配置）
  const mcp = new McpSessionManager();
  // 防重复：记录已向渲染器转发事件的会话 id，避免多次绑定导致重复消息
  const forwardedSessionIds = new Set<string>();
  // 自启动：记录已自启动的会话 id，便于退出时清理
  const autostartSessionIds = new Set<string>();

  // 中文注释：统一事件转发封装（若已转发过则跳过）
  const attachForwardingIfNeeded = (handle: SessionHandle) => {
    if (forwardedSessionIds.has(handle.id)) return;
    handle.client.on('tools:listChanged', () => {
      try { mainWindow?.webContents.send('mcp:tools:listChanged', { id: handle.id }); } catch { /* noop */ }
    });
    handle.client.on('notification', (n) => {
      try { mainWindow?.webContents.send('mcp:stream:data', { id: handle.id, notification: n }); } catch { /* noop */ }
    });
    handle.client.on('log', (level, message, meta) => {
      try { mainWindow?.webContents.send('mcp:log', { id: handle.id, level, message, meta }); } catch { /* noop */ }
    });
    handle.client.on('error', (err) => {
      try { mainWindow?.webContents.send('mcp:error', { id: handle.id, message: String(err) }); } catch { /* noop */ }
    });
    handle.client.on('close', (code?: number, reason?: string) => {
      try { mainWindow?.webContents.send('mcp:close', { id: handle.id, code, reason }); } catch { /* noop */ }
    });
    forwardedSessionIds.add(handle.id);
  };

  // 工具：为异步操作添加超时（静默失败，仅日志，不抛错）
  const withTimeout = async <T>(p: Promise<T>, ms: number, label: string): Promise<T | undefined> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      const t = new Promise<undefined>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`[timeout] ${label} > ${ms}ms`)), ms);
      });
      // 成功返回结果；失败走 catch
      return (await Promise.race([p, t])) as T;
    } catch (err) {
      if (process.env.VITE_DEV_SERVER_URL) {
        console.warn(`[mcp][autostart] ${label} 失败:`, err);
      }
      return undefined;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // 自启动：在后台并发拉起 mcp.json 的所有会话（start → initialize），每步 10s 超时
  const autostartMcp = async () => {
    try {
      // 路径优先级：环境变量 MF_MCP_CONFIG > apps/desktop/mcp.json（相对 __dirname）
      const envPath = (process.env.MF_MCP_CONFIG ?? '').trim();
      const appDefault = path.resolve(__dirname, '..', 'mcp.json');
      const configPath = envPath || (fs.existsSync(appDefault) ? appDefault : undefined);

      const handles = mcp.createFromConfig(configPath);
      if (process.env.VITE_DEV_SERVER_URL) {
        console.log('[mcp][autostart] sessions:', handles.map(h => h.id));
      }

      // 事件转发与登记
      for (const h of handles) {
        attachForwardingIfNeeded(h);
        autostartSessionIds.add(h.id);
      }

      // 并发启动与初始化（每步 10s 超时，失败静默）
      await Promise.allSettled(
        handles.map(async (h) => {
          await withTimeout(h.start(), 10_000, `${h.id}: start`);
          await withTimeout(h.initialize(), 10_000, `${h.id}: initialize`);
        }),
      );
      if (process.env.VITE_DEV_SERVER_URL) {
        console.log('[mcp][autostart] completed');
      }
    } catch (err) {
      // 配置缺失或解析失败：按需记录，不影响应用启动
      if (process.env.VITE_DEV_SERVER_URL) {
        console.warn('[mcp][autostart] skipped:', err);
      }
    }
  };

  // IPC：窗口控制与平台查询（确保 app 就绪后再注册）
  ipcMain.on('window:minimize', () => { try { mainWindow?.minimize(); } catch { /* noop */ } });
  ipcMain.on('window:toggle-maximize', () => {
    try {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    } catch { /* noop */ }
  });
  ipcMain.handle('window:is-maximized', () => {
    try { return !!mainWindow?.isMaximized(); } catch { return false; }
  });
  ipcMain.on('window:close', () => { try { mainWindow?.close(); } catch { /* noop */ } });
  ipcMain.handle('get-platform', () => getPlatformTag());

  // ========== 文件系统：选择目录（最小实现） ==========
  // 返回用户选择的第一个目录的绝对路径；取消则返回 null
  ipcMain.handle('fs:chooseDirectory', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
      });
      if (result.canceled || !result.filePaths?.length) return null;
      return result.filePaths[0] ?? null;
    } catch (err) {
      console.error('[fs:chooseDirectory] 失败:', err);
      return null;
    }
  });

  // 在系统文件管理器中显示并选中路径
  ipcMain.handle('fs:revealInFolder', async (_e, fullPath: string) => {
    try {
      await shell.showItemInFolder(fullPath);
      return true;
    } catch (err) {
      console.error('[fs:revealInFolder] 失败:', err);
      return false;
    }
  });

  // 保存 Markdown 报告到项目 reports 目录
  ipcMain.handle('fs:saveMarkdownReport', async (_e, projectPath: string, content: string, fileName?: string) => {
    try {
      if (!projectPath || typeof projectPath !== 'string') {
        return { ok: false, message: '无效的项目目录路径' };
      }
      if (typeof content !== 'string' || content.length === 0) {
        return { ok: false, message: '内容为空，未写入' };
      }
      const ts = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const tsName = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      const safeName = (fileName && /[^\\/:*?"<>|]/.test(fileName)) ? fileName : `project-outline-${tsName}.md`;
      const reportsDir = path.join(projectPath, 'reports');
      await fs.promises.mkdir(reportsDir, { recursive: true });
      const fullPath = path.join(reportsDir, safeName);
      await fs.promises.writeFile(fullPath, content, 'utf8');
      return { ok: true, fullPath };
    } catch (err) {
      console.error('[fs:saveMarkdownReport] 失败:', err);
      return { ok: false, message: String(err) };
    }
  });

  // ========== MCP 最小 IPC 接口 ==========
  // 说明：本期仅提供编程接口，不做 UI 配置对接
  ipcMain.handle('mcp/create', (_e, spec: SessionSpec) => {
    // 中文注释：仅创建，不自动连接/初始化
    const handle = mcp.create(spec);
    // 事件转发：最小实现将关键信号透传给当前主窗口
    if (!forwardedSessionIds.has(handle.id)) {
      handle.client.on('tools:listChanged', () => {
        try { mainWindow?.webContents.send('mcp:tools:listChanged', { id: handle.id }); } catch { /* noop */ }
      });
      handle.client.on('notification', (n) => {
        try { mainWindow?.webContents.send('mcp:stream:data', { id: handle.id, notification: n }); } catch { /* noop */ }
      });
      handle.client.on('log', (level, message, meta) => {
        try { mainWindow?.webContents.send('mcp:log', { id: handle.id, level, message, meta }); } catch { /* noop */ }
      });
      handle.client.on('error', (err) => {
        try { mainWindow?.webContents.send('mcp:error', { id: handle.id, message: String(err) }); } catch { /* noop */ }
      });
      handle.client.on('close', (code?: number, reason?: string) => {
        try { mainWindow?.webContents.send('mcp:close', { id: handle.id, code, reason }); } catch { /* noop */ }
      });
      forwardedSessionIds.add(handle.id);
    }
    return { id: handle.id };
  });

  // 通过 mcp.json 批量创建会话（不自动连接）。
  // 路径优先级：调用参数 > 环境变量 MF_MCP_CONFIG > 当前目录 ./mcp.json
  ipcMain.handle('mcp/createFromConfig', (_e, configPath?: string) => {
    try {
      const handles = mcp.createFromConfig(configPath);
      for (const handle of handles) {
        if (forwardedSessionIds.has(handle.id)) continue;
        // 事件转发与单个创建一致
        handle.client.on('tools:listChanged', () => {
          try { mainWindow?.webContents.send('mcp:tools:listChanged', { id: handle.id }); } catch { /* noop */ }
        });
        handle.client.on('notification', (n) => {
          try { mainWindow?.webContents.send('mcp:stream:data', { id: handle.id, notification: n }); } catch { /* noop */ }
        });
        handle.client.on('log', (level, message, meta) => {
          try { mainWindow?.webContents.send('mcp:log', { id: handle.id, level, message, meta }); } catch { /* noop */ }
        });
        handle.client.on('error', (err) => {
          try { mainWindow?.webContents.send('mcp:error', { id: handle.id, message: String(err) }); } catch { /* noop */ }
        });
        handle.client.on('close', (code?: number, reason?: string) => {
          try { mainWindow?.webContents.send('mcp:close', { id: handle.id, code, reason }); } catch { /* noop */ }
        });
        forwardedSessionIds.add(handle.id);
      }
      return { ids: handles.map(h => h.id) };
    } catch {
      // 静默：配置缺失/解析失败时返回空列表，避免开发时噪音
      return { ids: [] };
    }
  });
  ipcMain.handle('mcp/start', async (_e, id: string) => {
    const s = mcp.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    await s.start();
    return { ok: true };
  });
  ipcMain.handle('mcp/initialize', async (_e, id: string) => {
    const s = mcp.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    const result = await s.initialize();
    return result;
  });
  ipcMain.handle('mcp/listTools', async (_e, id: string, cursor?: string) => {
    const s = mcp.get(id);
    if (!s) {
      // 静默返回空结果，避免渲染器重试期间产生主进程错误日志
      return { tools: [], nextCursor: undefined as string | undefined };
    }
    try {
      return await s.client.listTools(cursor);
    } catch {
      // 静默降级：返回空列表而不是抛错（配合前端轮询/重试）
      return { tools: [], nextCursor: undefined as string | undefined };
    }
  });
  ipcMain.handle('mcp/callTool', async (_e, id: string, name: string, args?: Record<string, unknown>) => {
    const s = mcp.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    return await s.client.callTool(name, args as Record<string, unknown> | undefined);
  });
  ipcMain.handle('mcp/stop', async (_e, id: string) => {
    const s = mcp.get(id);
    if (!s) return { ok: true };
    await s.stop();
    return { ok: true };
  });

  ipcMain.handle('agent:react:invoke', async (_e, payload: ReactAgentPayload) => {
    try {
      if (!payload || !Array.isArray(payload.messages) || !payload.messages.length) {
        throw new Error('agent:react:invoke 参数不合法');
      }
      const result = await runReactAgent(payload.messages, { threadId: payload.threadId });
      console.info('[ipc][agent:react:invoke] 已完成一次 ReAct 调用');
      return result;
    } catch (err) {
      console.error('[ipc][agent:react:invoke] 调用失败:', err);
      throw err;
    }
  });

  // ========== Agent（流式日志 + 取消） ==========
  type AgentRunMap = Map<string, { active: boolean; controller: AbortController }>;
  const agentRuns: AgentRunMap = new Map();
  ipcMain.handle('agent:react:start', async (_e, payload: ReactAgentPayload) => {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ctrl = new AbortController();
    agentRuns.set(runId, { active: true, controller: ctrl });
    // 后台启动，不阻塞
    void (async () => {
      try {
        await startReactAgentStream(payload.messages, { threadId: payload.threadId }, {
          onStep: (step) => {
            try { mainWindow?.webContents.send('agent:react:step', { runId, step }); } catch { /* noop */ }
          },
          onFinal: (result) => {
            try { mainWindow?.webContents.send('agent:react:final', { runId, result }); } catch { /* noop */ }
            // 流结束（含正常、错误、取消后友好收尾）：清理运行态
            agentRuns.delete(runId);
          },
          onError: (err) => {
            try { mainWindow?.webContents.send('agent:react:error', { runId, message: String(err) }); } catch { /* noop */ }
            // 发生错误：清理运行态
            agentRuns.delete(runId);
          }
        }, ctrl);
      } catch { /* 已经通过 onError 上报 */ }
    })();
    return { runId };
  });
  ipcMain.handle('agent:react:cancel', async (_e, runId: string) => {
    const r = agentRuns.get(runId);
    if (!r) return { ok: true };
    try { r.controller.abort('user-cancel'); } catch { /* noop */ }
    // 不立即删除映射，让流的 onFinal/onError 负责清理，避免竞态
    return { ok: true };
  });

  await createWindow();
  // 启动后后台自启动 MCP（不阻塞 UI）
  void autostartMcp();
  // 同步初始化 LangChain 侧 MCP Runtime（不阻塞 UI）
  try { const { ensureMcpRuntime } = await import('./llm/mcp/runtime'); void ensureMcpRuntime(); } catch { /* noop */ }

  // 退出时清理自启动会话（幂等）
  app.on('before-quit', async () => {
    const ids = Array.from(autostartSessionIds);
    await Promise.allSettled(ids.map(id => mcp.get(id)?.stop()));
  });
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });

  // 清理：不再运行任何 smoke 自检逻辑。
});
