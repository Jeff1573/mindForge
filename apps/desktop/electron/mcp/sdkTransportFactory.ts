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
import { URL } from 'node:url';

// 更精确的传输联合类型，覆盖当前客户端支持的三种传输方式
export type AnyTransport =
  | StdioClientTransport
  | StreamableHTTPClientTransport
  | SSEClientTransport;

// 用于在联合穷尽时得到可靠的编译期提示
function assertNever(x: never): never {
  throw new Error('不支持的 transport.kind: ' + String(x));
}

// 将部分可选的重连配置安全收敛为 SDK 期望的完整结构；
// 若字段不完整，则返回 undefined 以沿用 SDK 默认值。
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

/** 创建不带连接副作用的传输实例 */
export function createSdkTransport(cfg: McpTransportConfig): AnyTransport {
  if (cfg.kind === 'stdio') {
    return new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      cwd: cfg.cwd,
      env: cfg.env,
      stderr: cfg.stderr ?? 'inherit',
    });
  }
  if (cfg.kind === 'http') {
    const opts: StreamableHTTPClientTransportOptions = {
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
      reconnectionOptions: toReconnectionOptions(cfg.reconnection),
      sessionId: cfg.sessionId,
    };
    return new StreamableHTTPClientTransport(new URL(cfg.url), opts);
  }
  if (cfg.kind === 'sse') {
    return new SSEClientTransport(new URL(cfg.url), {
      // 注：EventSourceInit 无 headers 字段；headers 放入 requestInit
      requestInit: cfg.headers ? { headers: cfg.headers } : undefined,
    });
  }
  return assertNever(cfg as never);
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
      // 注：EventSourceInit 无 headers 字段；headers 放入 requestInit
      requestInit: options?.headers ? { headers: options.headers } : undefined,
    });
    await client.connect(sse);
    return 'sse';
  }
  throw new Error('HTTP→SSE 回退失败：未能建立连接');
}
