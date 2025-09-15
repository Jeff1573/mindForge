/**
 * mcp.json 配置加载与路径解析
 * - 路径优先级：用户指定 > 环境变量（MF_MCP_CONFIG） > 当前工作目录 ./mcp.json
 * - 仅负责读取与基本校验，不做连接
 * 语言：简体中文
 */

import fs from 'node:fs';
import path from 'node:path';

export const ENV_MCP_CONFIG = 'MF_MCP_CONFIG';

export type McpTransportConfig =
  | ({ kind: 'stdio' } & {
      command: string;
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stderr?: 'inherit' | 'pipe' | number;
    })
  | ({ kind: 'http' } & {
      url: string;
      headers?: Record<string, string>;
      sessionId?: string;
      reconnection?: Partial<{
        maxReconnectionDelay: number;
        initialReconnectionDelay: number;
        reconnectionDelayGrowFactor: number;
        maxRetries: number;
      }>;
    })
  | ({ kind: 'sse' } & {
      url: string;
      headers?: Record<string, string>;
    });

export interface McpClientConfig {
  id: string;
  client?: { name?: string; version?: string };
  transport: McpTransportConfig;
}

export interface McpConfigFile {
  $schema?: string;
  clients: McpClientConfig[]; // 内部统一结构，由 mcpServers 转换而来
}

/** mcp.json 标准格式：mcpServers 映射 */
export interface McpServersMapConfig {
  mcpServers: Record<string, { url: string; headers?: Record<string, string> }>;
}

/** 解析配置文件路径 */
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

/** 加载并进行最小结构校验 */
export function loadMcpConfig(configPath?: string): McpConfigFile {
  const filePath = resolveMcpConfigPath(configPath);
  if (!filePath) throw new Error('未找到 mcp.json（请提供路径或设置环境变量 MF_MCP_CONFIG）');
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`mcp.json 解析失败：${(e as Error).message}`);
  }
  // 仅支持 { mcpServers: { name: { url, headers? } } } 格式
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const isHeaders = (v: unknown): v is Record<string, string> => {
    if (!isObject(v)) return false;
    for (const [k, val] of Object.entries(v)) {
      if (typeof k !== 'string' || typeof val !== 'string') return false;
    }
    return true;
  };
  if (isObject(data) && 'mcpServers' in data) {
    const rawMap = (data as { mcpServers?: unknown }).mcpServers;
    if (!isObject(rawMap)) throw new Error('mcp.json 格式错误：mcpServers 必须是对象');
    const clients: McpClientConfig[] = [];
    for (const [name, s] of Object.entries(rawMap as Record<string, unknown>)) {
      if (!isObject(s)) continue;
      const url = (s as { url?: unknown }).url;
      const headers = (s as { headers?: unknown }).headers;
      if (typeof url !== 'string') continue; // 忽略不完整项
      if (headers !== undefined && !isHeaders(headers)) continue; // 非法 headers 直接忽略
      clients.push({
        id: name,
        client: undefined,
        transport: { kind: 'http', url, headers: headers as Record<string, string> | undefined },
      });
    }
    if (clients.length === 0) throw new Error('mcp.json 未包含可用的 mcpServers（均缺少 url）');
    return { clients };
  }
  throw new Error('mcp.json 格式错误：仅支持 { mcpServers: { <name>: { url, headers? } } }');
}
