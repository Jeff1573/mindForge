import type { LLMMessage } from "./types";
import { runReactAgent } from "./reactAgentRunner";

export type ReactAgentSmokeOptions = {
  prompt?: string;
  threadId?: string;
  force?: boolean;
};

const DEFAULT_PROMPT = "请计算 12 * (3 + 4) 并解释步骤。";

/**
 * 在主进程中以最小配置运行 ReAct Agent，便于调试依赖与工具接入。
 */
export async function runReactAgentSmoke(opts: ReactAgentSmokeOptions = {}): Promise<void> {
  const shouldRun = opts.force || process.env.REACT_AGENT_SMOKE === "1";
  if (!shouldRun) return;

  const prompt = opts.prompt ?? process.env.REACT_AGENT_SMOKE_PROMPT ?? DEFAULT_PROMPT;
  const messages: LLMMessage[] = [{ role: "user", content: prompt }];

  console.log(`[ReactAgentSmoke] prompt="${prompt}"`);
  try {
    const result = await runReactAgent(messages, { threadId: opts.threadId });
    console.log(`[ReactAgentSmoke] 最终回复：${result.content}`);
    if (result.steps.length) {
      console.log("[ReactAgentSmoke] 推理轨迹：");
      for (const step of result.steps) {
        const toolInfo = step.toolCalls ? ` toolCalls=${JSON.stringify(step.toolCalls)}` : "";
        console.log(`  - role=${step.role}${toolInfo} => ${step.content}`);
      }
    }
  } catch (error) {
    console.error("[ReactAgentSmoke] 执行失败:", error);
    throw error;
  }
}
