import type { BaseMessageLike } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { LLMMessage } from "./types";
import { ensureAgentInput, getReactAgent } from "./graphs/reactAgent";
import { extractContentText } from "./utils/langchain";
import { buildStepSummaryTitle } from "./utils/summary";
import {
  AGENT_LOG_SCHEMA_VERSION,
  type AgentLogBatchResult,
  type AgentLogStep,
  type AgentRole,
  createStepId,
} from "@mindforge/shared";

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

/**
 * 运行 ReAct Agent 并返回结构化日志（一次性）。
 * - 输出遵循 shared 的 AgentLogBatchResult（schema v1）。
 * - UI 可直接按 steps 进行折叠/展开渲染；
 * - finalResult 独立用于 Markdown 完整展示。
 */
export async function runReactAgent(
  messages: LLMMessage[],
  options: ReactAgentRunOptions = {}
): Promise<AgentLogBatchResult> {
  try {
    // 中文注释：获取共享实例的 ReAct Agent（内部已缓存，避免重复构建）。
    const agent = await getReactAgent();
    const baseMessages = toAgentMessages(messages);
    const input = await ensureAgentInput(baseMessages);
    const config: RunnableConfig | undefined = options.threadId
      ? { configurable: { thread_id: options.threadId } }
      : undefined;
    const output = await agent.invoke(input, config);
    const agentMessages = (output as { messages?: BaseMessageLike[] }).messages ?? [];
    const rawSteps = toSerializableSteps(agentMessages);

    // 将内部步骤映射为共享的 AgentLogStep 结构
    const steps: AgentLogStep[] = rawSteps.map((s, idx) => {
      const role = normalizeRole(s.role);
      const id = createStepId(idx + 1, role);
      const summary = buildStepSummary(idx + 1, role, {
        content: s.content,
        toolCalls: s.toolCalls,
        toolCallId: s.toolCallId,
      });
      return {
        id,
        index: idx + 1,
        role,
        summary,
        content: s.content ?? "",
        toolCalls: s.toolCalls,
        toolCallId: s.toolCallId,
        ts: Date.now(),
      } satisfies AgentLogStep;
    });
    const finalMessage = steps.at(-1);
    const content = finalMessage?.content ?? "";

    // 中文注释：返回部分 system prompt 摘要，便于观察其对 Agent 行为的影响（避免在日志中输出完整内容）。
    const { getReactAgentSystemPrompt } = await import("./graphs/reactAgent");
    const systemPrompt = await getReactAgentSystemPrompt();
    const systemPromptExcerpt = systemPrompt.length > 200 ? `${systemPrompt.slice(0, 200)}…` : systemPrompt;

    const result: AgentLogBatchResult = {
      schemaVersion: AGENT_LOG_SCHEMA_VERSION,
      steps,
      finalResult: {
        type: "final_result",
        id: "final",
        content,
        format: "markdown",
        ts: Date.now(),
      },
      systemPromptExcerpt,
      // events 预留（当前按批量返回，不逐条推送）
    };

    return result;
  } catch (error) {
    console.error("[react-agent] 执行失败:", error);
    throw error;
  }
}

/** 将多源 role 归一为 AgentRole，未知归为 other。 */
function normalizeRole(role: unknown): AgentRole {
  if (typeof role !== "string") return "other";
  switch (role) {
    case "system":
    case "user":
    case "assistant":
    case "tool":
    case "tool_result":
      return role;
    default:
      return "other";
  }
}

// 构建更有信息量的步骤标题（为何：用于大纲视图的一句话概括；不含角色，保留 step#N）。
function buildStepSummary(
  index: number,
  role: AgentRole,
  s: { content?: unknown; toolCalls?: unknown; toolCallId?: unknown },
): string {
  return buildStepSummaryTitle(index, role, s.content ?? '', s.toolCalls, s.toolCallId, 50);
}
