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

  const results: Array<{ id: string; ok: boolean }> = [];

  for (const h of targets) {
    console.log(`\n=== [${h.id}] connecting...`);
    try {
      await h.start();
      console.log(`[${h.id}] transport started.`);
      const init = await h.initialize();
      const protocol = safeGet<string | undefined>(init.protocolVersion, undefined);
      const serverInfo = safeGet(init.serverInfo, { name: 'unknown', version: 'unknown' });
      console.log(
        `[${h.id}] initialized. server=name=${serverInfo.name}, version=${serverInfo.version}` +
          (protocol ? `, protocol=${protocol}` : ''),
      );

      // 尝试分页列出 tools
      let cursor: string | undefined = undefined;
      let total = 0;
      do {
        const respUnknown: unknown = await h.client.listTools(cursor);
        const resp: ListToolsResp = isListToolsResp(respUnknown) ? respUnknown : {};
        const tools = Array.isArray(resp.tools) ? resp.tools : [];
        for (const t of tools) {
          // 名称兜底
          const name = typeof t?.name === 'string' ? t.name : 'unknown';
          const desc = typeof t?.description === 'string' ? t.description : '';
          console.log(` - tool: ${name}${desc ? ` — ${desc}` : ''}`);
        }
        total += tools.length;
        cursor = typeof resp.nextCursor === 'string' && resp.nextCursor.length > 0 ? resp.nextCursor : undefined;
      } while (cursor);
      console.log(`[${h.id}] tools total=${total}`);

      results.push({ id: h.id, ok: true });
    } catch (err) {
      console.error(`[${h.id}] 连接失败: ${String((err as Error)?.message ?? err)}`);
      results.push({ id: h.id, ok: false });
    } finally {
      try { await h.stop(); } catch { /* noop */ }
    }
  }

  const summary = results.map((r) => `${r.id}:${r.ok ? 'ok' : 'fail'}`).join(', ');
  console.log(`\nSummary: ${summary}`);
  if (results.every((r) => !r.ok)) process.exitCode = 2;
}

main().catch((e) => {
  console.error('demo 致命错误：', e);
  process.exit(3);
});
