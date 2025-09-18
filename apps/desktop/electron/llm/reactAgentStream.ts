import type { BaseMessageLike } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { LLMMessage } from './types';
import { ensureAgentInput, getReactAgent, getReactAgentSystemPrompt } from './graphs/reactAgent';
import { extractContentText } from './utils/langchain';
import { buildStepSummaryTitle } from './utils/summary';
import {
  AGENT_LOG_SCHEMA_VERSION,
  createStepId,
  type AgentLogStep,
  type AgentRole,
  type AgentLogBatchResult,
} from '@mindforge/shared';

function toAgentMessages(messages: LLMMessage[]): BaseMessageLike[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

type MaybeMessageObject = {
  role?: string;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: string;
  _getType?: () => string;
};

function toSerializableSteps(messages: BaseMessageLike[]) {
  return messages.map((message) => {
    if (typeof message === 'string') {
      return { role: 'assistant', content: message };
    }
    if (Array.isArray(message)) {
      const [role, content] = message as [string, unknown];
      return { role, content: String(content) };
    }
    if (typeof message === 'object' && message !== null) {
      const obj = message as MaybeMessageObject;
      const resolvedRole = typeof obj._getType === 'function' ? obj._getType() : obj.role ?? 'assistant';
      return {
        role: resolvedRole,
        content: extractContentText(obj.content),
        toolCalls: obj.tool_calls,
        toolCallId: obj.tool_call_id,
      };
    }
    return { role: 'assistant', content: '' };
  });
}

function normalizeRole(role: unknown): AgentRole {
  if (typeof role !== 'string') return 'other';
  switch (role) {
    case 'system':
    case 'user':
    case 'assistant':
    case 'tool':
    case 'tool_result':
      return role;
    default:
      return 'other';
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

export type ReactAgentStreamCallbacks = {
  onStep: (step: AgentLogStep) => void;
  onFinal: (result: AgentLogBatchResult) => void;
  onError?: (err: unknown) => void;
};

export async function startReactAgentStream(
  messages: LLMMessage[],
  options: { threadId?: string } | undefined,
  cbs: ReactAgentStreamCallbacks,
): Promise<void> {
  const agent = await getReactAgent();
  const baseMessages = toAgentMessages(messages);
  const input = await ensureAgentInput(baseMessages);
  const config: RunnableConfig | undefined = options?.threadId
    ? { configurable: { thread_id: options.threadId } }
    : undefined;

  // 采用 LangGraph 的 values 流模式：每步返回完整 state（含 messages）
  // 对比上一状态，仅发增量步骤。
  let lastCount = 0;
  let lastSerial: ReturnType<typeof toSerializableSteps> = [];
  try {
    const stream: AsyncIterable<any> = await (agent as any).stream(input, { ...(config || {}), streamMode: 'values' });
    for await (const state of stream) {
      const arr: BaseMessageLike[] = (state?.messages ?? []) as BaseMessageLike[];
      const serial = toSerializableSteps(arr);
      lastSerial = serial;
      if (serial.length <= lastCount) continue;
      const added = serial.slice(lastCount);
      for (let i = 0; i < added.length; i++) {
        const s = added[i]!;
        const idx = lastCount + i + 1;
        const role = normalizeRole(s.role);
        const id = createStepId(idx, role);
        const summary = buildStepSummary(idx, role, {
          content: (s as any).content,
          toolCalls: (s as any).toolCalls,
          toolCallId: (s as any).toolCallId,
        });
        cbs.onStep({
          id,
          index: idx,
          role,
          summary,
          content: (s as any).content ?? '',
          toolCalls: (s as any).toolCalls,
          toolCallId: (s as any).toolCallId,
          ts: Date.now(),
        });
      }
      lastCount = serial.length;
    }

    // 完成：拼装最终结果
    const { getReactAgentSystemPrompt } = await import('./graphs/reactAgent');
    const systemPrompt = await getReactAgentSystemPrompt();
    const systemPromptExcerpt = systemPrompt.length > 200 ? `${systemPrompt.slice(0, 200)}…` : systemPrompt;
    const finalContent = lastSerial.at(-1)?.content ?? '';
    cbs.onFinal({
      schemaVersion: AGENT_LOG_SCHEMA_VERSION,
      steps: [],
      finalResult: { type: 'final_result', id: 'final', content: finalContent, format: 'markdown', ts: Date.now() },
      systemPromptExcerpt,
    });
  } catch (err) {
    cbs.onError?.(err);
    throw err;
  }
}
