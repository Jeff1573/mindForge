import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
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
import type { SessionSpec } from './mcp/sessionManager';
// LLM：最小接入（仅在主进程验证流式输出）
import { runLLMSmoke } from './llm/smoke';
import { runReactAgent } from './llm/reactAgentRunner';
import { runReactAgentSmoke } from './llm/reactAgentSmoke';
import type { LLMMessage } from './llm/types';

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

app.whenReady().then(async () => {
  // MCP：会话管理器（最小实现，不连接 UI 配置）
  const mcp = new McpSessionManager();
  // 防重复：记录已向渲染器转发事件的会话 id，避免多次绑定导致重复消息
  const forwardedSessionIds = new Set<string>();

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
    if (!s) throw new Error(`Session not found: ${id}`);
    return await s.client.listTools(cursor);
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

  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });

  // 可选：在主进程控制台进行 LLM 流式验证（设置 LLM_SMOKE=1 开启）
  // 说明：不会阻塞应用启动；失败会打印错误但不影响应用运行。
  runLLMSmoke().catch(() => {/* 已在内部记录错误 */});
  runReactAgentSmoke().catch(() => {/* 已在内部记录错误 */});
});
