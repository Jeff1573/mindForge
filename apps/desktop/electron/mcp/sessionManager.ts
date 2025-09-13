/**
 * MCP 会话管理器（主进程）
 * - 基于官方 SDK 封装客户端
 * - 支持三种传输，并在 HTTP 4xx 时回退到 SSE
 * - 支持从 mcp.json 批量创建会话
 * 语言：简体中文
 */

import { EventEmitter } from 'node:events';
import { SdkMcpClient, type McpInitializeResult } from './sdkClient';
import { createSdkTransport } from './sdkTransportFactory';
import { loadMcpConfig, type McpTransportConfig } from './config';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export interface SessionSpec {
  id: string;
  transport: McpTransportConfig;
  client?: { name?: string; version?: string; capabilities?: Record<string, unknown> };
}

export interface SessionHandle {
  id: string;
  client: SdkMcpClient;
  start: () => Promise<void>;
  initialize: () => Promise<McpInitializeResult>;
  stop: () => Promise<void>;
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
      capabilities: spec.client?.capabilities as any,
    });

    const handle: SessionHandle = {
      id: spec.id,
      client,
      start: async () => {
        if (spec.transport.kind === 'http') {
          try {
            const http = new StreamableHTTPClientTransport(new URL(spec.transport.url), {
              requestInit: spec.transport.headers ? { headers: spec.transport.headers } : undefined,
              reconnectionOptions: spec.transport.reconnection as any,
              sessionId: spec.transport.sessionId,
            });
            await client.start(http);
          } catch (err) {
            const code = err instanceof StreamableHTTPError ? err.code : undefined;
            if (!(code && code >= 400 && code < 500)) throw err;
            // 回退到 SSE
            const sse = new SSEClientTransport(new URL(spec.transport.url), {
              eventSourceInit: spec.transport.headers ? ({ headers: spec.transport.headers } as any) : undefined,
              requestInit: spec.transport.headers ? { headers: spec.transport.headers } : undefined,
            });
            await client.start(sse);
          }
          return;
        }
        const t = createSdkTransport(spec.transport);
        await client.start(t);
      },
      initialize: () => client.initialize(),
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
      const h = this.create({
        id: c.id,
        client: c.client,
        transport: c.transport,
      });
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
