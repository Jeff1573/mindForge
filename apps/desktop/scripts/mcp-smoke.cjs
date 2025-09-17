// MCP 端到端自检脚本（Node 可直接运行）。
// 用法：
//   npm run build:electron --workspace=@mindforge/desktop
//   node apps/desktop/scripts/mcp-smoke.cjs --id context7 --debug \
//     --prompt "请用 context7 简述 Next.js 路由（30字内）"
// 参数：--id <serverId> | --skip-agent | --debug | --config <path> | --topic <t> | --tokens <n> | --query <q>
//      | --inject | --placement <system|user-prepend|user-append> | --maxctx <n> | --sys-prefix <text> | --agent-only

const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');

function loadEnv() {
  try { dotenv.config({ path: path.resolve(__dirname, '../../..', '.env'), override: false }); } catch {}
  try { dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false }); } catch {}
}

function parseArgs(argv) {
  const out = { skipAgent: false, debug: false, inject: true, agentOnly: false };
  const leftovers = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') out.id = argv[++i];
    else if (a === '--prompt' || a === '-p') out.prompt = argv[++i];
    else if (a === '--skip-agent') out.skipAgent = true;
    else if (a === '--debug') out.debug = true;
    else if (a === '--config') out.configPath = argv[++i];
    else if (a === '--topic') out.topic = argv[++i];
    else if (a === '--tokens') out.maxDocTokens = Number(argv[++i]);
    else if (a === '--query') out.libraryQuery = argv[++i];
    else if (a === '--inject') out.inject = true;
    else if (a === '--placement') out.placement = argv[++i];
    else if (a === '--maxctx') out.maxCtxChars = Number(argv[++i]);
    else if (a === '--sys-prefix') out.systemPrefix = argv[++i];
    else if (a === '--agent-only') { out.agentOnly = true; out.skipAgent = false; }
    else if (a && !a.startsWith('-')) leftovers.push(a);
  }
  // 兼容：若未提供 --prompt，则将最后的自由参数拼接为 prompt
  if (!out.prompt && leftovers.length > 0) out.prompt = leftovers.join(' ');
  return out;
}

async function main() {
  loadEnv();
  const distMod = path.resolve(__dirname, '../dist/llm/mcp/smoke.js');
  if (!fs.existsSync(distMod)) {
    console.error('[mcp-smoke] 未找到已编译模块：%s', distMod);
    console.error('请先执行：npm run build:electron --workspace=@mindforge/desktop');
    process.exitCode = 1;
    return;
  }

  const { runMcpSmoke } = require(distMod);
  if (typeof runMcpSmoke !== 'function') {
    console.error('[mcp-smoke] 模块未导出 runMcpSmoke');
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  try {
    await runMcpSmoke({
      ...args,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mcp-smoke] 失败：%s', message);
    process.exitCode = 2;
  }
}

main();
