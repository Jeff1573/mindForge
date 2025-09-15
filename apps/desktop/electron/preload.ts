import { contextBridge, ipcRenderer } from 'electron';
import type { SessionSpec } from './mcp/sessionManager';
import type { McpInitializeResult } from './mcp/sdkClient';

// 中文注释：通过安全白名单 API 暴露必要能力给渲染器
const api = {
  // ========== 窗口控制 ==========
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  isMaximized: async () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  close: () => ipcRenderer.send('window:close'),
  onResized: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('window:resized', handler);
    return () => ipcRenderer.removeListener('window:resized', handler);
  },
  getPlatform: async () => ipcRenderer.invoke('get-platform') as Promise<'windows' | 'mac' | 'linux'>,

  // ========== 文件系统：目录选择 ==========
  // 说明：返回用户选择的目录绝对路径，若取消选择则为 null
  selectDirectory: async () =>
    ipcRenderer.invoke('fs:chooseDirectory') as Promise<string | null>,
  // 在资源管理器/访达中展示某个文件或目录
  revealInFolder: async (fullPath: string) =>
    ipcRenderer.invoke('fs:revealInFolder', fullPath) as Promise<boolean>,

  // ========== MCP（主进程桥） ==========
  mcp: {
    // 会话创建：从配置批量创建，不连接
    createFromConfig: (configPath?: string) =>
      ipcRenderer.invoke('mcp/createFromConfig', configPath) as Promise<{ ids: string[] }>,
    // 单个创建（预留，不自动连接）
    create: (spec: SessionSpec) => ipcRenderer.invoke('mcp/create', spec) as Promise<{ id: string }>,
    // 启动与握手
    start: (id: string) => ipcRenderer.invoke('mcp/start', id) as Promise<{ ok: true }>,
    initialize: (id: string) =>
      ipcRenderer.invoke('mcp/initialize', id) as Promise<McpInitializeResult>,
    // 工具列表（可能分页）
    listTools: (id: string, cursor?: string) =>
      ipcRenderer.invoke('mcp/listTools', id, cursor) as Promise<{
        tools: { name: string; description?: string }[];
        nextCursor?: string;
      }>,
    // 调用工具（页面暂不使用，预留）
    callTool: (id: string, name: string, args?: Record<string, unknown>) =>
      ipcRenderer.invoke('mcp/callTool', id, name, args) as Promise<unknown>,
    // 停止会话
    stop: (id: string) => ipcRenderer.invoke('mcp/stop', id) as Promise<{ ok: true }>,

    // 事件订阅：返回卸载函数，避免泄漏
    onToolsListChanged: (cb: (p: { id: string }) => void) => {
      const ch = 'mcp:tools:listChanged';
      const h = (_: unknown, payload: { id: string }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
    onError: (cb: (p: { id: string; message: string }) => void) => {
      const ch = 'mcp:error';
      const h = (_: unknown, payload: { id: string; message: string }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
    onClose: (cb: (p: { id: string; code?: number; reason?: string }) => void) => {
      const ch = 'mcp:close';
      const h = (_: unknown, payload: { id: string; code?: number; reason?: string }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type PreloadApi = typeof api;


