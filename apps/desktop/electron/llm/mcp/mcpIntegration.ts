/**
 * MCP 集成（最小实现）
 * - http：使用 OpenAI Responses API 的 Remote MCP（llm.bindTools）
 * - stdio：使用 @langchain/mcp-adapters 将 MCP 工具转为 LangChain Tool
 */

import { loadMcpConfig } from '../../mcp/config';
import type { McpTransportConfig } from '../../mcp/config';
import { getEnv } from '@mindforge/shared/env';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { Connection } from '@langchain/mcp-adapters';

export type RemoteMcpDef = {
  type: 'mcp';
  server_label: string;
  server_url: string;
  require_approval?: boolean;
  headers?: Record<string, string>;
};

export type McpIntegrationResult = {
  localTools: DynamicStructuredTool[]; // 通过 mcp-adapters 生成的工具（stdio/必要时 http 本地）
  remoteDefs: RemoteMcpDef[]; // 交给 ChatOpenAI.bindTools 的远程 MCP 定义（仅 http）
  needsResponsesApi: boolean; // OpenAI Chat 需启用 useResponsesApi
  dispose?: () => Promise<void>; // 退出清理
};

/**
 * 依据 mcp.json 与 AI_PROVIDER 选择接入方式。
 * 规则：
 * - transport.type === 'http' 且提供方为 openai → Remote MCP（remoteDefs）
 * - transport.type === 'stdio' → 本地 mcp-adapters（localTools）
 * - 若 provider 不是 openai，则 http 也走本地 mcp-adapters（作为兜底）
 */
export async function resolveMcpForLangChain(): Promise<McpIntegrationResult> {
  const env = getEnv();
  const cfg = loadMcpConfig();

  const isOpenAI = env.AI_PROVIDER === 'openai';
  const remoteDefs: RemoteMcpDef[] = [];

  // 收集需要走本地适配器的 server（stdio 或非 openai 环境下的 http/sse）
  type LocalEntry =
    | { id: string; type: 'stdio'; command: string; args?: string[]; cwd?: string; env?: Record<string, string> }
    | { id: string; type: 'http' | 'sse'; url: string; headers?: Record<string, string> };
  const localEntries: LocalEntry[] = [];

  for (const c of cfg.clients) {
    const t: McpTransportConfig = c.transport;
    if (t.type === 'http') {
      if (isOpenAI) {
        // 推荐：http 走 Remote MCP（仅在 OpenAI provider 下）
        remoteDefs.push({
          type: 'mcp',
          server_label: c.id,
          server_url: t.url,
          require_approval: false,
          headers: t.headers,
        });
      } else {
        // 兜底：非 OpenAI 环境，仍然通过本地适配器直连 http
        localEntries.push({ id: c.id, type: 'http', url: t.url, headers: t.headers });
      }
      continue;
    }
    if (t.type === 'stdio') {
      localEntries.push({ id: c.id, type: 'stdio', command: t.command, args: t.args, cwd: t.cwd, env: t.env });
      continue;
    }
    if (t.type === 'sse') {
      // 直接使用 SSE 作为本地适配器
      localEntries.push({ id: c.id, type: 'sse', url: t.url, headers: t.headers });
      continue;
    }
  }

  // 若没有本地条目，直接返回 remoteDefs
  if (localEntries.length === 0) {
    return { localTools: [], remoteDefs, needsResponsesApi: remoteDefs.length > 0 };
  }

  // 通过 mcp-adapters 连接本地/stdio/http/sse（本地）服务器，并产出 LangChain Tools
  const serversConfig: Record<string, Connection> = {};
  for (const e of localEntries) {
    if (e.type === 'stdio') {
      serversConfig[e.id] = {
        transport: 'stdio',
        command: e.command,
        args: e.args ?? [],
        cwd: e.cwd,
        env: e.env,
      };
    } else {
      serversConfig[e.id] = {
        transport: e.type, // 'http' | 'sse'
        url: e.url,
        headers: e.headers,
      };
    }
  }

  const client = new MultiServerMCPClient({
    mcpServers: serversConfig,
    // loadTools 选项：工具名添加服务器前缀；内容块走标准表示
    prefixToolNameWithServerName: true,
    useStandardContentBlocks: true,
  });

  const localTools = await client.getTools();
  const dispose = async () => {
    try { await client.close(); } catch { /* noop */ }
  };

  return { localTools, remoteDefs, needsResponsesApi: remoteDefs.length > 0, dispose };
}

