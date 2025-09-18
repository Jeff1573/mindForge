/**
 * MCP 会话管理器（主进程）
 * - 基于官方 SDK 封装客户端
 * - 支持三种传输，并在 HTTP 4xx 时回退到 SSE
 * - 支持从 mcp.json 批量创建会话
 * 语言：简体中文
 */

import { EventEmitter } from 'node:events';
import { URL } from 'node:url';
import { SdkMcpClient, type McpInitializeResult } from './sdkClient';
import { createSdkTransport } from './sdkTransportFactory';
import { loadMcpConfig, type McpTransportConfig } from './config';
import { StreamableHTTPClientTransport, StreamableHTTPError, type StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ClientOptions as SdkClientOptions } from '@modelcontextprotocol/sdk/client/index.js';

export interface SessionSpec {
  id: string;
  transport: McpTransportConfig;
  client?: { name?: string; version?: string; capabilities?: SdkClientOptions['capabilities'] };
}

// 本地化：将部分重连参数在存在且完整时传递给 SDK，否则使用其默认值
function toReconnectionOptions(
  p?: Partial<{
    maxReconnectionDelay: number;
    initialReconnectionDelay: number;
    reconnectionDelayGrowFactor: number;
    maxRetries: number;
  }>,
): StreamableHTTPClientTransportOptions['reconnectionOptions'] {
  if (!p) return undefined;
  const { maxReconnectionDelay, initialReconnectionDelay, reconnectionDelayGrowFactor, maxRetries } = p;
  if (
    typeof maxReconnectionDelay === 'number' &&
    typeof initialReconnectionDelay === 'number' &&
    typeof reconnectionDelayGrowFactor === 'number' &&
    typeof maxRetries === 'number'
  ) {
    return { maxReconnectionDelay, initialReconnectionDelay, reconnectionDelayGrowFactor, maxRetries };
  }
  return undefined;
}

export interface SessionHandle {
  id: string;
  client: SdkMcpClient;
  start: () => Promise<void>;
  initialize: () => Promise<McpInitializeResult>;
  stop: () => Promise<void>;
}

// MCP 启动状态总结输出工具
// 约束：仅输出一行 JSON，字段固定为 { server, success, tools }
function printMcpStartupSummary(payload: { server: string; success: boolean; tools: string[] }): void {
  try {
    // 输出单行 JSON，方便日志采集
    console.log(JSON.stringify(payload));
  } catch {
    // 忽略日志序列化异常，避免影响主流程
  }
}

// 收集工具名称（分页 & 兼容 nextCursor/next_cursor），并做严格的运行时守卫
async function collectToolNames(client: SdkMcpClient): Promise<string[]> {
  const names = new Set<string>();
  let cursor: string | undefined = undefined;
  const MAX_PAGES = 20; // 防止某些服务端无限分页
  const MAX_TOOLS = 1000; // 上限保护，避免过量日志

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let res: unknown;
    try {
      res = await client.listTools(cursor);
    } catch {
      // 列表失败不影响主流程，直接终止收集
      break;
    }

    if (!res || typeof res !== 'object') break;
    const tools: unknown = (res as { tools?: unknown }).tools;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        const name = t && typeof t === 'object' ? (t as { name?: unknown }).name : undefined;
        if (typeof name === 'string' && name.length > 0) {
          names.add(name);
          if (names.size >= MAX_TOOLS) break;
        }
      }
    }

    const nextCursor = (res as { nextCursor?: unknown }).nextCursor;
    const next_cursor = (res as { next_cursor?: unknown }).next_cursor;
    const next = typeof nextCursor === 'string' ? nextCursor : typeof next_cursor === 'string' ? next_cursor : undefined;
    if (!next || names.size >= MAX_TOOLS) break;
    cursor = next;
  }

  return Array.from(names);
}

export class McpSessionManager extends EventEmitter {
  private readonly sessions = new Map<string, SessionHandle>();
  private readonly defaultClientInfo = { name: 'mindforge-desktop', version: '0.0.0' };

  /**
   * 创建但不自动连接/初始化（保持与旧接口一致）
   */
  create(spec: SessionSpec): SessionHandle {
    if (this.sessions.has(spec.id)) throw new Error(`Session already exists: ${spec.id}`);

    const client = new SdkMcpClient({
      clientInfo: {
        name: spec.client?.name ?? this.defaultClientInfo.name,
        version: spec.client?.version ?? this.defaultClientInfo.version,
      },
      capabilities: spec.client?.capabilities,
    });

    const handle: SessionHandle = {
      id: spec.id,
      client,
      start: async () => {
        // 启动阶段：若最终失败则输出失败总结日志（success:false）
        try {
          if (spec.transport.type === 'http') {
            try {
              const http = new StreamableHTTPClientTransport(new URL(spec.transport.url), {
                requestInit: spec.transport.headers ? { headers: spec.transport.headers } : undefined,
                reconnectionOptions: toReconnectionOptions(spec.transport.reconnection),
                sessionId: spec.transport.sessionId,
              });
              await client.start(http);
            } catch (err) {
              const code = err instanceof StreamableHTTPError ? err.code : undefined;
              if (!(code && code >= 400 && code < 500)) throw err;
              // 回退到 SSE
              const sse = new SSEClientTransport(new URL(spec.transport.url), {
                // 注：EventSourceInit 无 headers 字段；headers 放入 requestInit
                requestInit: spec.transport.headers ? { headers: spec.transport.headers } : undefined,
              });
              await client.start(sse);
            }
            return;
          }
          const t = createSdkTransport(spec.transport);
          await client.start(t);
        } catch (err) {
          // 启动失败：server 名回退为配置 id，tools 为空
          printMcpStartupSummary({ server: spec.id, success: false, tools: [] });
          throw err;
        }
      },
      initialize: async () => {
        // 初始化阶段：成功后输出成功总结日志，并附工具名列表
        try {
          const init = await client.initialize();
          const serverName = (init && typeof init === 'object' && (init as { serverInfo?: unknown }).serverInfo &&
            typeof (init as { serverInfo?: { name?: unknown } }).serverInfo?.name === 'string')
            ? String((init as { serverInfo: { name: unknown } }).serverInfo.name)
            : spec.id;
          const tools = await collectToolNames(client).catch(() => []);
          printMcpStartupSummary({ server: serverName, success: true, tools });
          return init;
        } catch (err) {
          // 初始化失败：输出失败总结日志
          printMcpStartupSummary({ server: spec.id, success: false, tools: [] });
          throw err;
        }
      },
      stop: async () => {
        try { await client.stop(); } catch { /* noop */ }
      },
    };

    // 事件透传给上层（主进程 → 渲染器）
    client.on('tools:listChanged', () => this.emit('tools:listChanged', spec.id));
    client.on('notification', (n) => this.emit('notification', spec.id, n));
    client.on('log', (level, message, meta) => this.emit('log', spec.id, level, message, meta));
    client.on('error', (err) => this.emit('error', spec.id, err));
    client.on('close', (code?: number, reason?: string) => this.emit('close', spec.id, code, reason));

    this.sessions.set(spec.id, handle);
    return handle;
  }

  /** 从配置文件批量创建会话（不连接） */
  createFromConfig(configPath?: string): SessionHandle[] {
    const cfg = loadMcpConfig(configPath);
    const handles: SessionHandle[] = [];
    for (const c of cfg.clients) {
      const existing = this.sessions.get(c.id);
      if (existing) {
        // 已存在：直接返回已有句柄，避免抛错（便于 HMR/页面重载）
        handles.push(existing);
        continue;
      }
      const h = this.create({ id: c.id, client: c.client, transport: c.transport });
      handles.push(h);
    }
    return handles;
  }

  get(id: string): SessionHandle | undefined {
    return this.sessions.get(id);
  }

  list(): string[] {
    return Array.from(this.sessions.keys());
  }

  async remove(id: string): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) return;
    await s.stop();
    this.sessions.delete(id);
  }
}

