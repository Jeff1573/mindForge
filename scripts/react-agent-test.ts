// 说明：Node.js 脚本，用于在本地直接调用 ReAct Agent 并打印结果。
// 使用方式：
//   1) 设置 OPENAI_API_KEY 或 AI_API_KEY（可用 OpenAI 兼容服务）
//   2) npx tsx scripts/react-agent-test.ts "<你的问题>"
//      或通过环境变量 REACT_AGENT_TEST_PROMPT 指定 prompt
//
// 安全性：仅输出 system prompt 的前 200 字符摘要，避免泄露完整提示词。

import 'dotenv/config';

import type { LLMMessage } from '../apps/desktop/electron/llm/types';
import { runReactAgent } from '../apps/desktop/electron/llm/reactAgentRunner';

function getCliPrompt(): string | undefined {
  const [, , ...args] = process.argv;
  if (args.length > 0) {
    return args.join(' ').trim();
  }
  return undefined;
}

async function main() {
  const DEFAULT_PROMPT = '请计算 24 / (2 + 4) 并解释步骤。';
  const prompt = getCliPrompt() || process.env.REACT_AGENT_TEST_PROMPT || DEFAULT_PROMPT;

  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
  console.log(`[react-agent-test] prompt="${prompt}"`);

  try {
    const result = await runReactAgent(messages);
    console.log(`[react-agent-test] systemPromptExcerpt: ${result.systemPromptExcerpt}`);
    console.log(`[react-agent-test] 最终回复：${result.finalResult?.content ?? ''}`);
    if (result.steps.length) {
      console.log('[react-agent-test] 推理轨迹：');
      for (const step of result.steps) {
        const toolInfo = step.toolCalls ? ` toolCalls=${JSON.stringify(step.toolCalls)}` : '';
        console.log(`  - #${step.index} ${step.summary}${toolInfo} => ${step.content}`);
      }
    }
  } catch (err) {
    console.error('[react-agent-test] 执行失败：', err);
    process.exitCode = 1;
  }
}

main();
