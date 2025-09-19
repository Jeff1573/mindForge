/**
 * 文档：Agent 端到端（含 MCP 工具）自测脚本
 *
 * 作用：
 * - 直接复用 Electron 主进程现有模块（getReactAgent + ensureMcpRuntime），
 *   在同一运行时下验证「提示词 → LLM → LangGraph ReAct → MCP 工具」整链路可用性。
 *
 * 使用：
 * - npm run agent:test --workspace=@mindforge/desktop -- [-m "你好"] [--include serena,context7]
 *   - --include：设置 MF_MCP_INCLUDE，仅连接指定的 MCP server（逗号分隔）。
 *
 * 约束：
 * - 不新增依赖；仅使用项目内既有工厂/运行时。
 * - 仅作为诊断脚本，完成后可按需删除。
 */

import type { BaseMessageLike } from '@langchain/core/messages';
import { ensureMcpRuntime } from '../mcp/runtime';
import { getReactAgent, ensureAgentInput } from '../graphs/reactAgent';

type Args = { message: string; include?: string; responses?: 'true' | 'false' | 'auto' };

function parseArgs(argv: string[]): Args {
  const args: Args = { message: '请用一句话自我介绍，并说明当前可用的 MCP 工具个数。', responses: 'auto' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : undefined);
    if (a === '-m' || a === '--message') args.message = next() ?? args.message;
    else if (a === '--include') args.include = next();
    else if (a === '--responses') {
      const v = (next() ?? 'auto').toLowerCase();
      args.responses = v === 'true' ? 'true' : v === 'false' ? 'false' : 'auto';
    }
  }
  return args;
}

function info(label: string, data?: unknown) {
  if (data !== undefined) console.log(`[agent:test] ${label}:`, data);
  else console.log(`[agent:test] ${label}`);
}

async function main() {
  const { message, include, responses } = parseArgs(process.argv.slice(2));
  if (include && include.trim()) process.env.MF_MCP_INCLUDE = include.trim();
  if (responses === 'true') process.env.OPENAI_USE_RESPONSES_API = '1';
  if (responses === 'false') process.env.OPENAI_USE_RESPONSES_API = '0';

  info('初始化 MCP 运行时…');
  const mcp = await ensureMcpRuntime();
  info('MCP 工具数', mcp.tools?.length ?? 0);

  info('构建 React Agent…');
  if (process.env.AI_PROVIDER?.toLowerCase() === 'openai') {
    const mode = process.env.OPENAI_USE_RESPONSES_API === '1' ? 'responses' : 'chat';
    info(`OpenAI 模式`, mode);
  }
  const agent = await getReactAgent();

  const messages: BaseMessageLike[] = [{ role: 'user', content: message } as any];
  const input = await ensureAgentInput(messages);

  info('开始执行…');
  try {
    const res = await (agent as any).invoke(input);
    // 直接打印结果对象的关键字段，方便问题排查
    const out = typeof res?.content === 'string' ? res.content : JSON.stringify(res, null, 2);
    console.log(out);
    process.exit(0);
  } catch (err) {
    console.error('[agent:test] 执行失败：', (err as Error).message);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
