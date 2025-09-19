/**
 * mcp.json 配置加载与路径解析
 * - 路径优先级：调用参数 > 环境变量 MF_MCP_CONFIG > 当前目录 ./mcp.json
 * - 解析时使用 Zod 做格式校验，禁止吞掉错误
 */

import fs from 'node:fs';
import path from 'node:path';

import { z, type ZodError } from 'zod';
import type { ClientOptions as SdkClientOptions } from '@modelcontextprotocol/sdk/client/index.js';

export const ENV_MCP_CONFIG = 'MF_MCP_CONFIG';

export type McpTransportConfig =
  | ({ type: 'stdio' } & {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      // 与 @langchain/mcp-adapters 对齐：Windows 兼容的 overlapped 以及常见枚举；不再接受 number 形式
      stderr?: 'overlapped' | 'pipe' | 'ignore' | 'inherit';
      // 进程自动重启（推荐默认开启）：若缺省将由调用方设置默认值
      restart?: Partial<{
        enabled: boolean;
        maxAttempts: number;
        delayMs: number;
      }>;
    })
  | ({ type: 'http' } & {
      url: string;
      headers?: Record<string, string>;
      sessionId?: string;
      // 历史字段（向后兼容，调用方不会使用）：
      reconnection?: Partial<{
        maxReconnectionDelay: number;
        initialReconnectionDelay: number;
        reconnectionDelayGrowFactor: number;
        maxRetries: number;
      }>;
      // 新字段：可流式 HTTP 的自动回退与重连（与 mcp-adapters 一致）
      automaticSSEFallback?: boolean;
      reconnect?: Partial<{
        enabled: boolean;
        maxAttempts: number;
        delayMs: number;
      }>;
    })
  | ({ type: 'sse' } & {
      url: string;
      headers?: Record<string, string>;
      reconnect?: Partial<{
        enabled: boolean;
        maxAttempts: number;
        delayMs: number;
      }>;
    });

export interface McpClientConfig {
  id: string;
  client?: { name?: string; version?: string; capabilities?: SdkClientOptions['capabilities'] };
  transport: McpTransportConfig;
}

export interface McpConfigFile {
  $schema?: string;
  clients: McpClientConfig[];
}

export interface McpServersMapConfig {
  $schema?: string;
  mcpServers: Record<string, RawMcpServerEntry>;
}

const headersSchema = z.record(z.string().trim());

const reconnectionSchema = z
  .object({
    maxReconnectionDelay: z.number().positive().optional(),
    initialReconnectionDelay: z.number().positive().optional(),
    reconnectionDelayGrowFactor: z.number().positive().optional(),
    maxRetries: z.number().nonnegative().optional(),
  })
  .partial();

const clientInfoSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    version: z.string().trim().min(1).optional(),
    capabilities: z.unknown().optional(),
  })
  .optional();

const rawServerEntrySchema = z
  .object({
    type: z.enum(['http', 'stdio', 'sse']).optional(),
    url: z.string().trim().min(1).optional(),
    headers: headersSchema.optional(),
    sessionId: z.string().trim().min(1).optional(),
    reconnection: reconnectionSchema.optional(), // 兼容旧字段（不会被新实现使用）
    reconnect: z
      .object({ enabled: z.boolean().optional(), maxAttempts: z.number().optional(), delayMs: z.number().optional() })
      .partial()
      .optional(),
    automaticSSEFallback: z.boolean().optional(),
    command: z.string().trim().min(1).optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().trim().min(1).optional(),
    env: headersSchema.optional(),
    stderr: z.union([z.literal('overlapped'), z.literal('pipe'), z.literal('ignore'), z.literal('inherit')]).optional(),
    restart: z
      .object({ enabled: z.boolean().optional(), maxAttempts: z.number().optional(), delayMs: z.number().optional() })
      .partial()
      .optional(),
    client: clientInfoSchema,
  })
  .passthrough();

const rawConfigSchema = z.object({
  $schema: z.string().optional(),
  mcpServers: z.record(z.string().trim().min(1), rawServerEntrySchema),
});

type RawMcpServerEntry = z.infer<typeof rawServerEntrySchema>;
type RawMcpConfig = z.infer<typeof rawConfigSchema>;

function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  const pathLabel = issue.path.length ? issue.path.join('.') : '根节点';
  return `${pathLabel}: ${issue.message}`;
}

/**
 * 中文注释：将 mcp.json 中的单个条目转为 SDK 传输配置，过程中做字段级校验。
 */
function toTransportConfig(serverId: string, entry: RawMcpServerEntry): McpTransportConfig {
  // 判别字段统一为 	ype；未提供时按 command/url 启发式，sse 必须显式声明。
  const resolvedType: RawMcpServerEntry['type'] | 'http' | 'stdio' | 'sse' | undefined =
    entry.type ?? (entry.command ? 'stdio' : entry.url ? 'http' : undefined);

  if (!resolvedType) {
    throw new Error(`mcp.json 条目 "${serverId}" 缺少 url 或 command，无法推断传输类型`);
  }

  if (resolvedType === 'stdio') {
    if (!entry.command) {
      throw new Error(`mcp.json 条目 "${serverId}" stdio 配置缺少 command`);
    }
    return {
      type: 'stdio',
      command: entry.command,
      args: entry.args,
      cwd: entry.cwd,
      env: entry.env,
      stderr: entry.stderr ?? 'inherit',
      restart: entry.restart,
    };
  }

  if (resolvedType === 'http') {
    if (!entry.url) {
      throw new Error(`mcp.json 条目 "${serverId}" http 配置缺少 url`);
    }
    return {
      type: 'http',
      url: entry.url,
      headers: entry.headers,
      sessionId: entry.sessionId,
      reconnection: entry.reconnection,
      automaticSSEFallback: entry.automaticSSEFallback,
      reconnect: entry.reconnect,
    };
  }

  if (resolvedType === 'sse') {
    if (!entry.url) {
      throw new Error(`mcp.json 条目 "${serverId}" sse 配置缺少 url`);
    }
    return {
      type: 'sse',
      url: entry.url,
      headers: entry.headers,
      reconnect: entry.reconnect,
    };
  }

  throw new Error(`mcp.json 条目 "${serverId}" 使用了暂不支持的传输类型：${resolvedType}`);
}

/**
 * 中文注释：对 capabilities 做最小结构校验并返回符合 SDK 类型的值。
 */
function normalizeCapabilities(
  value: unknown
): SdkClientOptions['capabilities'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as SdkClientOptions['capabilities'];
}

/**
 * 中文注释：统一封装客户端配置，剔除空字段以便后续序列化。
 */
function toClientConfig(serverId: string, entry: RawMcpServerEntry): McpClientConfig {
  const transport = toTransportConfig(serverId, entry);
  const clientInfo = entry.client ?? {};
  const cleanedClient = {
    name: clientInfo.name,
    version: clientInfo.version,
    capabilities: normalizeCapabilities(clientInfo.capabilities),
  };
  const hasClient = Object.values(cleanedClient).some((value) => value !== undefined);

  return {
    id: serverId,
    client: hasClient ? cleanedClient : undefined,
    transport,
  };
}

/**
 * 中文注释：解析 mcp.json 的磁盘路径，供 CLI 与 Electron 主进程复用。
 */
export function resolveMcpConfigPath(userPath?: string): string | null {
  if (userPath && userPath.trim().length > 0) {
    return path.resolve(process.cwd(), userPath);
  }

  const envPath = process.env[ENV_MCP_CONFIG];
  if (envPath && envPath.trim().length > 0) {
    return path.resolve(process.cwd(), envPath);
  }

  const cwdDefault = path.resolve(process.cwd(), 'mcp.json');
  return fs.existsSync(cwdDefault) ? cwdDefault : null;
}

/**
 * 中文注释：加载 mcp.json 并做结构化校验，返回内部统一的客户端配置列表。
 */
export function loadMcpConfig(configPath?: string): McpConfigFile {
  const filePath = resolveMcpConfigPath(configPath);
  if (!filePath) {
    throw new Error('未找到 mcp.json（请提供路径或设置环境变量 MF_MCP_CONFIG）');
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取 mcp.json 失败：${(error as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(`mcp.json 解析失败：${(error as Error).message}`);
  }

  const result = rawConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`mcp.json 校验失败：${formatZodError(result.error)}`);
  }

  const rawConfig: RawMcpConfig = result.data;
  const clients = Object.entries(rawConfig.mcpServers).map(([serverId, entry]) =>
    toClientConfig(serverId, entry)
  );

  if (clients.length === 0) {
    throw new Error('mcp.json 未包含任何有效的 mcpServers 配置');
  }

  return {
    $schema: rawConfig.$schema,
    clients,
  };
}




