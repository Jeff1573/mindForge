/**
 * 基于官方 SDK 的 MCP 客户端薄封装
 * - 兼容现有事件语义：`tools:listChanged`、`notification`、`log`、`error`、`close`
 * - 方法：start/connect、initialize、listTools、callTool
 * - 说明：SDK 的 connect() 已完成初始化握手；本封装在 initialize() 中回传握手结果以保持旧接口不变
 * 语言：简体中文
 */

import { EventEmitter } from 'node:events';
import {
  Client,
  type ClientOptions as SdkClientOptions,
} from '@modelcontextprotocol/sdk/client/index.js';
// 说明：为避免对 SDK 内部路径的直接类型依赖，这里对 Transport 使用最小 any 类型。
// SDK 在运行时会通过 connect() 进行校验，类型弱化不影响安全性。
type AnyTransport = any;

// 类型：与旧实现保持最小对齐（只暴露调用所需字段）
export interface McpInitializeResult {
  protocolVersion: string | undefined;
  capabilities: Record<string, unknown> | undefined;
  serverInfo: { name: string; version: string } | undefined;
  instructions?: string | undefined;
}

export interface McpClientOptions {
  clientInfo: { name: string; version: string };
  capabilities?: SdkClientOptions['capabilities'];
  enforceStrictCapabilities?: SdkClientOptions['enforceStrictCapabilities'];
  debouncedNotificationMethods?: SdkClientOptions['debouncedNotificationMethods'];
}

/**
 * SdkMcpClient：委托 @modelcontextprotocol/sdk 的 Client
 */
export class SdkMcpClient extends EventEmitter {
  private readonly sdk: Client;
  private transport?: AnyTransport;

  constructor(options: McpClientOptions) {
    super({ captureRejections: true });
    this.sdk = new Client(
      { name: options.clientInfo.name, version: options.clientInfo.version },
      {
        capabilities: options.capabilities,
        enforceStrictCapabilities: options.enforceStrictCapabilities,
        debouncedNotificationMethods: options.debouncedNotificationMethods,
      },
    );

    // 事件桥接：close/error
    this.sdk.onclose = () => {
      try { this.emit('close'); } catch { /* noop */ }
    };
    this.sdk.onerror = (err) => {
      try { this.emit('error', err); } catch { /* noop */ }
    };

    // 通知桥接：统一转发，并对 list_changed 做兼容事件名
    this.sdk.fallbackNotificationHandler = async (n: any) => {
      try {
        if (n?.method === 'notifications/tools/list_changed') {
          this.emit('tools:listChanged');
        }
        this.emit('notification', n);
      } catch { /* noop */ }
    };
  }

  /**
   * 连接传输（SDK 会在 connect() 内完成 initialize 握手）
   */
  async start(transport: AnyTransport): Promise<void> {
    this.transport = transport;
    await this.sdk.connect(transport);
  }

  /**
   * 与旧接口对齐：返回握手信息（从 SDK getter 读取）
   */
  async initialize(): Promise<McpInitializeResult> {
    return {
      protocolVersion: (this.transport as any)?.protocolVersion ?? undefined,
      capabilities: this.sdk.getServerCapabilities() as any,
      serverInfo: this.sdk.getServerVersion() as any,
      instructions: this.sdk.getInstructions?.(),
    };
  }

  /** 列出工具（支持 cursor） */
  async listTools(cursor?: string): Promise<any> {
    const params = cursor ? { cursor } : undefined;
    return await this.sdk.listTools(params as any);
  }

  /** 调用工具 */
  async callTool(name: string, args?: Record<string, unknown>): Promise<any> {
    return await this.sdk.callTool({ name, arguments: args ?? {} } as any);
  }

  /** 停止并关闭底层连接 */
  async stop(): Promise<void> {
    try { await (this.sdk as any)?.transport?.close?.(); } catch { /* noop */ }
  }
}

export default SdkMcpClient;
