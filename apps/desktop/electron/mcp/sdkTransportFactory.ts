/**
 * SDK 传输工厂与辅助方法
 * - 支持 stdio / streamable-http / sse
 * - 提供 HTTP→SSE 回退的辅助连接方法
 * 语言：简体中文
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
  type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpTransportConfig } from './config';

export type AnyTransport = any; // 避免直接依赖 SDK 内部类型路径

/** 创建不带连接副作用的传输实例 */
export function createSdkTransport(cfg: McpTransportConfig): AnyTransport {
  if (cfg.kind === 'stdio') {
    return new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      cwd: cfg.cwd,
      env: cfg.env,
      stderr: (cfg.stderr as any) ?? 'inherit',
    });
  }
  if (cfg.kind === 'http') {
    const opts: StreamableHTTPClientTransportOptions = {
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      reconnectionOptions: cfg.reconnection as any,
      sessionId: cfg.sessionId,
    };
    return new StreamableHTTPClientTransport(new URL(cfg.url), opts);
  }
  if (cfg.kind === 'sse') {
    return new SSEClientTransport(new URL(cfg.url), {
      eventSourceInit: cfg.headers ? ({ headers: cfg.headers } as any) : undefined,
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
    });
  }
  throw new Error(`不支持的 transport.kind: ${(cfg as any)?.kind}`);
}

/**
 * 辅助：尝试 Streamable HTTP，若 4xx 则回退 SSE（与官方示例一致）
 */
export async function connectWithHttpSseFallback(
  client: Client,
  baseUrl: string,
  options?: { headers?: Record<string, string>; sseOnly?: boolean; httpOnly?: boolean }
): Promise<'http' | 'sse'> {
  const url = new URL(baseUrl);
  if (!options?.sseOnly) {
    try {
      const http = new StreamableHTTPClientTransport(url, {
        requestInit: options?.headers ? { headers: options.headers } : undefined,
      });
      await client.connect(http);
      return 'http';
    } catch (err) {
      // 仅 4xx 场景回退（老服务器仅支持 SSE）
      const code = err instanceof StreamableHTTPError ? err.code : undefined;
      if (!(code && code >= 400 && code < 500)) throw err;
      // 否则继续尝试 SSE
    }
  }
  if (!options?.httpOnly) {
    const sse = new SSEClientTransport(url, {
      eventSourceInit: options?.headers ? ({ headers: options.headers } as any) : undefined,
      requestInit: options?.headers ? { headers: options.headers } : undefined,
    });
    await client.connect(sse);
    return 'sse';
  }
  throw new Error('HTTP→SSE 回退失败：未能建立连接');
}

