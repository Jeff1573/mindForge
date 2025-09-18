import { contextBridge, ipcRenderer } from 'electron';
// 类型仅用于声明，避免将主进程实现细节引入到预加载产物
import type { LLMMessage } from './llm/types';
import type { AgentLogBatchResult } from '@mindforge/shared';
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
  // 保存 Markdown 报告到项目 reports 目录
  saveMarkdownReport: async (projectPath: string, content: string, fileName?: string) =>
    ipcRenderer.invoke('fs:saveMarkdownReport', projectPath, content, fileName) as Promise<{
      ok: boolean;
      fullPath?: string;
      message?: string;
    }>,

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

  // ========== Agent（ReAct 调用最小桥接） ==========
  // 说明：
  // - 为测试与开发用途暴露到 renderer；仅封装 IPC 通道，不做任何业务处理。
  // - 约束：payload.messages 至少包含一条消息；消息结构遵循 LLMMessage（system/user/assistant）。
  // - 边界：当前仅一次性返回，不提供流式更新；长耗时由前端负责展示 loading。
  agent: {
    reactInvoke: (payload: { messages: LLMMessage[]; threadId?: string }) =>
      ipcRenderer.invoke('agent:react:invoke', payload) as Promise<AgentLogBatchResult>,
    // 流式：启动 + 事件订阅 + 取消
    reactStart: (payload: { messages: LLMMessage[]; threadId?: string }) =>
      ipcRenderer.invoke('agent:react:start', payload) as Promise<{ runId: string }>,
    onReactStep: (cb: (p: { runId: string; step: any }) => void) => {
      const ch = 'agent:react:step';
      const h = (_: unknown, payload: { runId: string; step: any }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
    onReactFinal: (cb: (p: { runId: string; result: AgentLogBatchResult }) => void) => {
      const ch = 'agent:react:final';
      const h = (_: unknown, payload: { runId: string; result: AgentLogBatchResult }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
    onReactError: (cb: (p: { runId: string; message: string }) => void) => {
      const ch = 'agent:react:error';
      const h = (_: unknown, payload: { runId: string; message: string }) => cb(payload);
      ipcRenderer.on(ch, h);
      return () => ipcRenderer.removeListener(ch, h);
    },
    reactCancel: (runId: string) => ipcRenderer.invoke('agent:react:cancel', runId) as Promise<{ ok: true }>,
  },
};

contextBridge.exposeInMainWorld('api', api);

export type PreloadApi = typeof api;


