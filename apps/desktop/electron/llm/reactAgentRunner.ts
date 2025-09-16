import type { BaseMessageLike } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { LLMMessage } from "./types";
import { ensureAgentInput, getReactAgent } from "./graphs/reactAgent";
import { extractContentText } from "./utils/langchain";

export type ReactAgentRunOptions = {
  threadId?: string;
};

export type ReactAgentStep = {
  role: string;
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
};

type MaybeMessageObject = {
  role?: string;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  _getType?: () => string;
};

function toAgentMessages(messages: LLMMessage[]): BaseMessageLike[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

function toSerializableSteps(messages: BaseMessageLike[]): ReactAgentStep[] {
  return messages.map((message) => {
    if (typeof message === "string") {
      return { role: "assistant", content: message };
    }
    if (Array.isArray(message)) {
      const [role, content] = message;
      return { role, content: String(content) };
    }
    if (typeof message === "object" && message !== null) {
      const obj = message as MaybeMessageObject;
      const resolvedRole = typeof obj._getType === "function"
        ? obj._getType()
        : obj.role ?? "assistant";
      return {
        role: resolvedRole,
        content: extractContentText(obj.content),
        toolCalls: obj.tool_calls,
        toolCallId: obj.tool_call_id
      };
    }
    return { role: "assistant", content: "" };
  });
}

export async function runReactAgent(
  messages: LLMMessage[],
  options: ReactAgentRunOptions = {}
): Promise<{ content: string; steps: ReactAgentStep[]; systemPromptExcerpt: string }> {
  try {
    const agent = await getReactAgent();
    const baseMessages = toAgentMessages(messages);
    const input = await ensureAgentInput(baseMessages);
    const config: RunnableConfig | undefined = options.threadId
      ? { configurable: { thread_id: options.threadId } }
      : undefined;
    const output = await agent.invoke(input, config);
    const agentMessages = (output as { messages?: BaseMessageLike[] }).messages ?? [];
    const steps = toSerializableSteps(agentMessages);
    const finalMessage = steps.at(-1);
    const content = finalMessage?.content ?? "";

    // 中文注释：返回部分 system prompt 摘要，便于观察其对 Agent 行为的影响（避免在日志中输出完整内容）。
    const { getReactAgentSystemPrompt } = await import("./graphs/reactAgent");
    const systemPrompt = await getReactAgentSystemPrompt();
    const systemPromptExcerpt = systemPrompt.length > 200 ? `${systemPrompt.slice(0, 200)}…` : systemPrompt;

    return { content, steps, systemPromptExcerpt };
  } catch (error) {
    console.error("[react-agent] 执行失败:", error);
    throw error;
  }
}
