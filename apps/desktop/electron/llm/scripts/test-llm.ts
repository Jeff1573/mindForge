/**
 * 文档：LLM 连通性自测脚本（可独立运行）
 *
 * 作用：
 * - 按当前环境变量与可选 CLI 入参，尝试向所选提供商发送最小消息，判断是否“可用”。
 * - 对 OpenAI 提供商，支持在失败时自动切换 Chat Completions/Responses API 进行二次探测，
 *   并给出推荐的 OPENAI_USE_RESPONSES_API 设置建议。
 *
 * 使用：
 * - npm run llm:test --workspace=@mindforge/desktop -- [-m "你好"] [--provider openai] [--model gpt-4o-mini]
 *   [--base-url http://.../v1] [--responses auto|true|false]
 *
 * 约束：
 * - 不新增任何依赖；仅使用项目内工厂方法创建模型。
 * - 输出仅做最小必要脱敏（API Key 末 4 位）。
 */

import { getEnv } from '@mindforge/shared';
import { invokeRawPrompt } from '../../llm/factory';

type Args = {
  message: string;
  provider?: string;
  model?: string;
  baseURL?: string;
  responses?: 'auto' | 'true' | 'false';
};

function parseArgs(argv: string[]): Args {
  const args: Args = { message: '你好，能听到我吗？' , responses: 'auto' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : undefined);
    if (a === '-m' || a === '--message') args.message = next() ?? args.message;
    else if (a === '--provider') args.provider = next();
    else if (a === '--model') args.model = next();
    else if (a === '--base-url') args.baseURL = next();
    else if (a === '--responses') {
      const v = (next() ?? 'auto').toLowerCase();
      args.responses = v === 'true' ? 'true' : v === 'false' ? 'false' : 'auto';
    }
  }
  return args;
}

function mask(s?: string): string {
  if (!s) return '';
  return s.replace(/.(?=.{4})/g, '*');
}

async function tryInvoke(useResponsesApi?: boolean, message = 'ping') {
  const res = await invokeRawPrompt(message, {
    provider: process.env.AI_PROVIDER as any,
    model: process.env.AI_MODEL,
    baseURL: process.env.AI_BASE_URL,
    // 仅在 provider=openai 时生效；已由 factory.ts 正式支持并下传到 createOpenAIClient
    openaiUseResponsesApi: useResponsesApi,
  });
  return String(res.content ?? '').trim();
}

function setIf(val: string | undefined, name: string) {
  if (typeof val === 'string' && val.trim().length > 0) process.env[name] = val.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = getEnv();

  // 允许 CLI 覆写关键变量（仅当前进程内有效）
  setIf(args.provider, 'AI_PROVIDER');
  setIf(args.model, 'AI_MODEL');
  setIf(args.baseURL, 'AI_BASE_URL');

  const provider = (args.provider ?? env.AI_PROVIDER).toLowerCase();
  const base = args.baseURL ?? env.AI_BASE_URL ?? env.OPENAI_BASE_URL ?? '';
  const model = args.model ?? env.AI_MODEL ?? env.OPENAI_MODEL ?? env.GOOGLE_MODEL ?? '';
  const apiKey = env.OPENAI_API_KEY || env.AI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GROQ_API_KEY || '';

  console.log('[LLM Test] provider=%s model=%s base=%s key=%s', provider, model || '(default)', base || '(default)', mask(apiKey));

  // OpenAI: 根据 --responses 决策；auto 模式下遇到失败会切换一次。
  if (provider === 'openai') {
    const pref = args.responses ?? 'auto';
    const first = pref === 'true' ? true : pref === 'false' ? false : undefined; // undefined -> factory/env 决策
    try {
      const text = await tryInvoke(first, args.message);
      console.log('[Success/%s] %s', first === undefined ? 'env' : first ? 'responses' : 'chat', text.slice(0, 160));
      process.exit(0);
    } catch (eFirst) {
      if (pref !== 'auto') {
        console.error('[Fail/%s] %s', first ? 'responses' : 'chat', (eFirst as Error).message);
        process.exit(1);
      }
      // auto: 反向再试一次
      const fallback = first === true ? false : true; // 若 env 走 responses 则改为 chat，反之亦然
      try {
        const text = await tryInvoke(fallback, args.message);
        console.log('[Success/%s] %s', fallback ? 'responses' : 'chat', text.slice(0, 160));
        console.log('\n建议：设置环境变量 OPENAI_USE_RESPONSES_API=%s', fallback ? '1' : '0');
        process.exit(0);
      } catch (eSecond) {
        console.error('[Fail/env] %s', (eFirst as Error).message);
        console.error('[Fail/fallback] %s', (eSecond as Error).message);
        process.exit(1);
      }
    }
    return;
  }

  // 其它提供商：仅做一次最小调用
  try {
    const text = await tryInvoke(undefined, args.message);
    console.log('[Success] %s', text.slice(0, 160));
    process.exit(0);
  } catch (e) {
    console.error('[Fail] %s', (e as Error).message);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
