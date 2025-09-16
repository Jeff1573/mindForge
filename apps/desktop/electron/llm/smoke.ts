import { getEnv } from '@mindforge/shared';
import type { AIProvider } from '@mindforge/shared';
import { invokeLLM, streamLLM } from './factory';
import type { LLMCallOptions, LLMInvokeResult, LLMMessage } from './types';

export type LLMSmokeOptions = {
  provider?: AIProvider;
  prompt?: string;
  systemPrompt?: string;
  options?: LLMCallOptions;
  force?: boolean;
};

const DEFAULT_PROMPT = '请用一句中文介绍你自己，并控制在 30 字以内。';
const DEFAULT_SYSTEM = '你是严谨的助手。';

/**
 * 在主进程或 Node CLI 中运行最小化的 LLM 验证链路。
 * - 支持按环境变量/入参选择模型提供商与提示语。
 * - 优先尝试流式输出，若提供商未实现则回退到一次性调用。
 */
export async function runLLMSmoke(opts: LLMSmokeOptions = {}): Promise<void> {
  const shouldRun = opts.force || process.env.LLM_SMOKE === '1';
  if (!shouldRun) return;

  const env = getEnv();
  const provider = opts.provider ?? env.AI_PROVIDER;
  const prompt = opts.prompt ?? process.env.LLM_SMOKE_PROMPT ?? DEFAULT_PROMPT;
  const system = opts.systemPrompt ?? DEFAULT_SYSTEM;
  const options = opts.options;

  const messages: LLMMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt }
  ];

  const banner = `[LLMSmoke] provider=${provider} model=${env.AI_MODEL ?? '默认'} prompt="${prompt}"`;
  console.log(banner);

  try {
    // 优先使用流式输出（若未实现则抛错，进入 fallback）
    const stream = await streamLLM({ messages, options }, { provider });
    let acc = '';
    for await (const chunk of stream) {
      if (!chunk) continue;
      acc += chunk;
      process.stdout.write(chunk);
    }
    if (acc) {
      process.stdout.write('\n');
      console.log(`[LLMSmoke] 完成，累计 ${acc.length} 字符`);
      return;
    }
    console.log('[LLMSmoke] 流式输出无增量内容，改用 invoke 结果。');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[LLMSmoke] 流式调用失败：${message}，自动回退 invoke。`);
  }

  // 回退：直接调用一次性生成
  try {
    const result = await invokeLLM({ messages, options }, { provider });
    printInvokeResult(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[LLMSmoke] 执行失败：${message}`);
    throw err;
  }
}

function printInvokeResult(result: LLMInvokeResult) {
  const text = result.content?.trim();
  if (text) {
    console.log(`[LLMSmoke] invoke 输出：${text}`);
  } else {
    console.log('[LLMSmoke] invoke 无纯文本内容，原始结果：');
    console.dir(result.raw, { depth: 3 });
  }
}
