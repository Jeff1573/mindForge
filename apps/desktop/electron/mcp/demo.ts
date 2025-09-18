/**
 * 最小可用 MCP 连接 Demo（Node CLI）
 * - 读取 apps/desktop/mcp.json（可用 --config 指定其它路径）
 * - 使用现有 McpSessionManager 逐一连接、initialize，并列出 tools
 * - 运行：npm run mcp:demo --workspace=@mindforge/desktop -- [--config apps/desktop/mcp.json] [--id <serverId>]
 */

import path from 'node:path';
import process from 'node:process';
import { McpSessionManager } from './sessionManager';
import { resolveMcpConfigPath } from './config';

type CliArgs = {
  config?: string;
  id?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--config') out.config = argv[++i];
    else if (a === '--id') out.id = argv[++i];
  }
  return out;
}

function safeGet<T>(v: unknown, fallback: T): T {
  return (v as T) ?? fallback;
}

type ListToolsResp = {
  tools?: Array<{ name?: string; description?: string }>;
  nextCursor?: string;
};

function isListToolsResp(v: unknown): v is ListToolsResp {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  const tools = o.tools;
  if (tools !== undefined && !Array.isArray(tools)) return false;
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // 默认读取 apps/desktop/mcp.json（相对本文件目录推导）
  const defaultCfg = path.resolve(__dirname, '../../mcp.json');
  const cfgPath = resolveMcpConfigPath(args.config ?? defaultCfg);
  if (!cfgPath) {
    console.error('未找到 mcp.json：请使用 --config 指定或设置环境变量 MF_MCP_CONFIG');
    process.exitCode = 1;
    return;
  }

  const mgr = new McpSessionManager();
  const handles = mgr.createFromConfig(cfgPath);
  const targets = args.id ? handles.filter((h) => h.id === args.id) : handles;
  if (targets.length === 0) {
    console.error('mcp.json 中没有可用的客户端条目，或未匹配到指定 --id');
    process.exitCode = 1;
    return;
  }

  // 汇总结果：仅最终输出机器可读 JSON（stdout）
  const outputs: Array<{ id: string; status: 'ok' | 'fail'; tools: string[] }> = [];

  for (const h of targets) {
    const toolNames = new Set<string>();
    try {
      await h.start();
      await h.initialize();

      // 分页收集工具名称（仅 name）
      let cursor: string | undefined = undefined;
      do {
        const respUnknown: unknown = await h.client.listTools(cursor);
        const resp: ListToolsResp = isListToolsResp(respUnknown) ? respUnknown : {};
        const tools = Array.isArray(resp.tools) ? resp.tools : [];
        for (const t of tools) {
          const name = typeof t?.name === 'string' ? t.name : undefined;
          if (name && name.length > 0) toolNames.add(name);
        }
        cursor = typeof resp.nextCursor === 'string' && resp.nextCursor.length > 0 ? resp.nextCursor : undefined;
      } while (cursor);

      outputs.push({ id: h.id, status: 'ok', tools: Array.from(toolNames) });
    } catch (err) {
      // 仅记录失败，不在过程中输出描述/日志到 stdout
      console.error(`[${h.id}] 连接失败: ${String((err as Error)?.message ?? err)}`);
      outputs.push({ id: h.id, status: 'fail', tools: [] });
    } finally {
      try { await h.stop(); } catch { /* noop */ }
    }
  }

  // 最终一次性输出 JSON（仅包含 server、状态、tools 名称）
  // 说明：保留退出码语义——若全部失败，exitCode=2，否则为 0
  console.log(JSON.stringify(outputs, null, 2));
  if (outputs.length > 0 && outputs.every((r) => r.status === 'fail')) process.exitCode = 2;
}

main().catch((e) => {
  console.error('demo 致命错误：', e);
  process.exit(3);
});
