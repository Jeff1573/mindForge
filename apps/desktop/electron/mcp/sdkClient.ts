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
import type { AnyTransport } from './sdkTransportFactory';
// 说明：为避免对 SDK 内部路径的直接类型依赖，这里对 Transport 使用最小 any 类型。
// SDK 在运行时会通过 connect() 进行校验，类型弱化不影响安全性。
// 使用工厂导出的精确传输联合类型
// 统一避免 any，提高关闭/协议版本读取时的类型提示
// 注意：不同传输实现可能未公开相同属性，访问前需做存在性检查


// 类型：与旧实现保持最小对齐（只暴露调用所需字段）
export interface McpInitializeResult {
  protocolVersion: string | undefined;
  // 使用 Client 实例派生的返回类型，避免宽泛的 Record
  capabilities: ReturnType<Client['getServerCapabilities']> | undefined;
  serverInfo: ReturnType<Client['getServerVersion']> | undefined;
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
    // 统一转发 SDK 的通知；对旧事件名做兼容映射
    this.sdk.fallbackNotificationHandler = async (n) => {
      try {
        // 仅在具备 method 字段且为目标字符串时触发兼容事件
        if (n && typeof (n as { method?: unknown }).method === 'string' &&
            (n as { method: string }).method === 'notifications/tools/list_changed') {
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
    let protocolVersion: string | undefined;
    const t = this.transport as unknown;
    if (t && typeof t === 'object' && 'protocolVersion' in (t as Record<string, unknown>)) {
      const pv = (t as { protocolVersion?: unknown }).protocolVersion;
      protocolVersion = typeof pv === 'string' ? pv : undefined;
    }
    return {
      protocolVersion,
      capabilities: this.sdk.getServerCapabilities(),
      serverInfo: this.sdk.getServerVersion(),
      instructions: this.sdk.getInstructions?.(),
    };
  }

  /** 列出工具（支持 cursor） */
  async listTools(cursor?: string) {
    const params = cursor ? { cursor } : undefined;
    return await this.sdk.listTools(params);
  }

  /** 调用工具 */
  async callTool(name: string, args?: Record<string, unknown>) {
    return await this.sdk.callTool({ name, arguments: args ?? {} });
  }

  /** 停止并关闭底层连接 */
  async stop(): Promise<void> {
    try {
      const tr = this.transport as unknown;
      const closeFn = (tr && typeof tr === 'object' && 'close' in (tr as Record<string, unknown>)
        ? (tr as { close?: () => unknown }).close
        : undefined);
      if (typeof closeFn === 'function') {
        await closeFn.call(tr);
      }
    } catch { /* noop */ }
  }
}

export default SdkMcpClient;
