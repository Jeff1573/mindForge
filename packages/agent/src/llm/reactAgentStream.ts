import type { BaseMessageLike } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { buildStepSummaryTitle } from './utils/summary';
import type { LLMMessage } from './types';
import { ensureAgentInput, getReactAgentWithoutMcp } from './graphs/reactAgent';
import { extractContentText } from './utils/langchain';

export type ReactAgentStreamCallbacks = {
  onStep: (step: {
    id: string;
    index: number;
    role: string;
    content: string;
    toolCalls?: unknown;
    toolCallId?: string;
    summary: string;
    ts: number;
  }) => void;
  onFinal: (result: {
    schemaVersion: number;
    steps: unknown[];
    finalResult: { type: 'final_result'; id: 'final'; content: string; format: 'markdown'; ts: number };
    systemPromptExcerpt: string;
  }) => void;
  onError?: (err: unknown) => void;
};

function toAgentMessages(messages: LLMMessage[]): BaseMessageLike[] {
  return messages.map((msg) => ({ role: msg.role, content: msg.content }));
}

export async function startReactAgentStream(
  messages: LLMMessage[],
  options: { threadId?: string } | undefined,
  cbs: ReactAgentStreamCallbacks,
  externalAbortController?: AbortController,
): Promise<void> {
  const RECURSION_LIMIT = Number.parseInt(process.env.MF_RECURSION_LIMIT || '', 10) || 100;
  const MAX_TOOL_CALLS = Number.parseInt(process.env.MF_MAX_TOOL_CALLS || '', 10) || 20;
  const DEV_LOG = !!process.env.VITE_DEV_SERVER_URL || process.env.MF_DEBUG === 'agent-stream';

  const agent = await getReactAgentWithoutMcp();
  const baseMessages = toAgentMessages(messages);
  const input = await ensureAgentInput(baseMessages);
  const abortController = externalAbortController ?? new AbortController();
  const config: RunnableConfig | undefined = options?.threadId
    ? { configurable: { thread_id: options.threadId }, signal: abortController.signal }
    : { signal: abortController.signal };

  let lastCount = 0;
  let lastSerial: ReturnType<typeof toSerializableSteps> = [];
  let toolCallCount = 0;
  let abortedByGuard = false;
  let abortReason = '';
  try {
    const stream: AsyncIterable<any> = await (agent as any).stream(input, {
      ...(config || {}),
      streamMode: 'values',
      recursionLimit: RECURSION_LIMIT,
    });
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

        const hasToolCalls = Array.isArray((s as any).toolCalls)
          ? ((s as any).toolCalls as any[]).length > 0
          : !!(s as any).toolCalls;
        if (role === 'assistant' && hasToolCalls) {
          toolCallCount += 1;
          if (DEV_LOG) console.log('[react-agent][stream] step#%d toolCalls(+1) => %d', idx, toolCallCount);
        } else if (DEV_LOG) {
          console.log('[react-agent][stream] step#%d role=%s', idx, role);
        }

        if (toolCallCount >= MAX_TOOL_CALLS) {
          abortedByGuard = true;
          abortReason = `达到工具调用上限(${MAX_TOOL_CALLS})，为避免可能的循环已安全停止`;
          try { abortController.abort('tool-call-limit'); } catch {}
          break;
        }
      }
      lastCount = serial.length;
    }

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
    if (abortedByGuard) {
      const { getReactAgentSystemPrompt } = await import('./graphs/reactAgent');
      const systemPrompt = await getReactAgentSystemPrompt();
      const systemPromptExcerpt = systemPrompt.length > 200 ? `${systemPrompt.slice(0, 200)}…` : systemPrompt;
      const lastContent = lastSerial.at(-1)?.content ?? '';
      const explain = `已${abortReason}。请检查问题是否需要额外信息或改用不同工具/参数。\n\n最后上下文：\n${lastContent}`;
      cbs.onFinal({
        schemaVersion: AGENT_LOG_SCHEMA_VERSION,
        steps: [],
        finalResult: { type: 'final_result', id: 'final', content: explain, format: 'markdown', ts: Date.now() },
        systemPromptExcerpt,
      });
      return;
    }

    const aborted = (() => {
      const reason = (abortController as any)?.signal?.reason ?? undefined;
      if ((abortController as any)?.signal?.aborted) return true;
      if (reason) return true;
      if (err && typeof err === 'object' && 'name' in (err as any)) {
        const n = String((err as any).name || '').toLowerCase();
        if (n.includes('abort')) return true;
      }
      if (err && typeof err === 'object' && 'message' in (err as any)) {
        const m = String((err as any).message || '').toLowerCase();
        if (m.includes('abort') || m.includes('cancell')) return true;
      }
      if (typeof err === 'string' && err.toLowerCase().includes('abort')) return true;
      return false;
    })();

    if (aborted) {
      const { getReactAgentSystemPrompt } = await import('./graphs/reactAgent');
      const systemPrompt = await getReactAgentSystemPrompt();
      const systemPromptExcerpt = systemPrompt.length > 200 ? `${systemPrompt.slice(0, 200)}…` : systemPrompt;
      const lastContent = lastSerial.at(-1)?.content ?? '';
      const reason = (abortController as any)?.signal?.reason ?? '用户已终止任务';
      const explain = `任务已终止（原因：${String(reason)}）。已保留截至终止时的上下文摘要。\n\n最后上下文：\n${lastContent}`;
      cbs.onFinal({
        schemaVersion: AGENT_LOG_SCHEMA_VERSION,
        steps: [],
        finalResult: { type: 'final_result', id: 'final', content: explain, format: 'markdown', ts: Date.now() },
        systemPromptExcerpt,
      });
      return;
    }

    cbs.onError?.(err);
    throw err;
  }
}

import { createStepId, type AgentRole, AGENT_LOG_SCHEMA_VERSION } from '@mindforge/shared';

type ReactAgentStep = { role: string; content: string; toolCalls?: unknown; toolCallId?: string };

function toSerializableSteps(messages: BaseMessageLike[]): ReactAgentStep[] {
  return messages.map((message) => {
    if (typeof message === 'string') return { role: 'assistant', content: message };
    if (Array.isArray(message)) {
      const [role, content] = message; return { role, content: String(content) };
    }
    if (typeof message === 'object' && message !== null) {
      const obj = message as any;
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

function buildStepSummary(
  index: number,
  role: AgentRole,
  s: { content?: unknown; toolCalls?: unknown; toolCallId?: unknown },
): string {
  return buildStepSummaryTitle(index, role, s.content ?? '', s.toolCalls, s.toolCallId, 50);
}
