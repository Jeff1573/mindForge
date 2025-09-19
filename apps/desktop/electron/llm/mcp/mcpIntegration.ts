/**
 * MCP 集成（统一实现）
 * - 使用 @langchain/mcp-adapters 的 MultiServerMCPClient 直连 stdio/http/sse，
 *   将全部 MCP 工具加载为 LangChain Tools 并交由 LangGraph Agent 使用。
 * - 不再区分“远程（OpenAI bindTools）/本地”两条路径，统一本地直连。
 */

import { loadMcpConfig } from '../../mcp/config';
import type { McpTransportConfig } from '../../mcp/config';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { Connection } from '@langchain/mcp-adapters';

export type McpIntegrationResult = {
  /** 通过 mcp-adapters 生成的 LangChain Tools（包含 stdio/http/sse） */
  tools: DynamicStructuredTool[];
  /** 退出清理：关闭底层连接与子进程（可幂等） */
  dispose?: () => Promise<void>;
};

/**
 * 将 mcp.json 的客户端配置映射为 MultiServerMCPClient 的连接配置，并返回 Tools。
 * 默认值（推荐）：
 * - stdio.restart: { enabled: true, maxAttempts: 3, delayMs: 1000 }
 * - http.automaticSSEFallback: true；http/sse.reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 }
 * - 工具命名前缀：开启（serverName/toolName）
 * - 内容块：使用标准表示（useStandardContentBlocks=true）
 */
export async function resolveMcpForLangChain(): Promise<McpIntegrationResult> {
  const cfg = loadMcpConfig();
  // 允许通过环境变量过滤需要加载的 MCP（逗号分隔）
  const includeRaw = (process.env.MF_MCP_INCLUDE || '').trim();
  const includeIds = includeRaw.length > 0 ? includeRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  // 收集连接条目（统一走本地适配器）
  type Entry =
    | { id: string; type: 'stdio'; command: string; args?: string[]; cwd?: string; env?: Record<string, string>; stderr?: 'overlapped'|'pipe'|'ignore'|'inherit' }
    | { id: string; type: 'http' | 'sse'; url: string; headers?: Record<string, string> };
  const entries: Entry[] = [];

  for (const c of cfg.clients) {
    if (includeIds.length > 0 && !includeIds.includes(c.id)) continue; // 过滤
    const t: McpTransportConfig = c.transport;
    if (t.type === 'stdio') {
      // 将 config 中的 stderr 规范化为 SDK 支持的枚举，非法值降级为 'inherit'
      const stderr = ((): 'overlapped' | 'pipe' | 'ignore' | 'inherit' => {
        const v = (t as any).stderr;
        return v === 'overlapped' || v === 'pipe' || v === 'ignore' || v === 'inherit' ? v : 'inherit';
      })();
      entries.push({ id: c.id, type: 'stdio', command: t.command, args: t.args, cwd: t.cwd, env: t.env, stderr });
      continue;
    }
    if (t.type === 'http') {
      entries.push({ id: c.id, type: 'http', url: t.url, headers: t.headers });
      continue;
    }
    if (t.type === 'sse') {
      entries.push({ id: c.id, type: 'sse', url: t.url, headers: t.headers });
      continue;
    }
  }

  // 没有配置任何 MCP，返回空工具集
  if (entries.length === 0) {
    return { tools: [] };
  }

  // 构造 MultiServerMCPClient 所需的连接映射
  const serversConfig: Record<string, Connection> = {};
  for (const e of entries) {
    if (e.type === 'stdio') {
      serversConfig[e.id] = {
        transport: 'stdio',
        command: e.command,
        args: e.args ?? [],
        cwd: e.cwd,
        env: e.env,
        stderr: e.stderr ?? 'inherit',
        // 推荐默认：崩溃自动重启，避免开发期子进程意外退出造成工具缺失
        restart: { enabled: true, maxAttempts: 3, delayMs: 1000 },
      } as Connection;
      continue;
    }

    // http/sse：统一开启自动回退与重连
    serversConfig[e.id] = {
      transport: e.type, // 'http' | 'sse'
      url: (e as any).url,
      headers: (e as any).headers,
      automaticSSEFallback: true,
      reconnect: { enabled: true, maxAttempts: 5, delayMs: 2000 },
    } as Connection;
  }

  const client = new MultiServerMCPClient({
    mcpServers: serversConfig,
    // 工具加载选项：前缀 serverName，使用标准内容块
    prefixToolNameWithServerName: true,
    useStandardContentBlocks: true,
  });

  const tools = await client.getTools();
  const dispose = async () => {
    try { await client.close(); } catch { /* noop */ }
  };

  return { tools, dispose };
}

