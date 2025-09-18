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

// 中文注释：
// - 兼容扩展：新增可选的外部 AbortController（用于主进程 runId 级取消）。
// - 向后兼容：若未传入，则内部自建控制器，保留原行为。
export async function startReactAgentStream(
  messages: LLMMessage[],
  options: { threadId?: string } | undefined,
  cbs: ReactAgentStreamCallbacks,
  externalAbortController?: AbortController,
): Promise<void> {
  // 读取递归上限与工具调用上限（可通过环境变量覆盖）
  // 中文注释：
  // - MF_RECURSION_LIMIT：LangGraph 内部步数上限（防止递归过深导致 GraphRecursionError）
  // - MF_MAX_TOOL_CALLS：在一次会话流中允许的最多工具调用次数（达到即中止并给出解释性最终答复）
  const RECURSION_LIMIT = Number.parseInt(process.env.MF_RECURSION_LIMIT || '', 10) || 100;
  const MAX_TOOL_CALLS = Number.parseInt(process.env.MF_MAX_TOOL_CALLS || '', 10) || 20;
  const DEV_LOG = !!process.env.VITE_DEV_SERVER_URL || process.env.MF_DEBUG === 'agent-stream';

  const agent = await getReactAgent();
  const baseMessages = toAgentMessages(messages);
  const input = await ensureAgentInput(baseMessages);
  const abortController = externalAbortController ?? new AbortController();
  const config: RunnableConfig | undefined = options?.threadId
    ? { configurable: { thread_id: options.threadId }, signal: abortController.signal }
    : { signal: abortController.signal };

  // 采用 LangGraph 的 values 流模式：每步返回完整 state（含 messages）
  // 对比上一状态，仅发增量步骤。
  let lastCount = 0;
  let lastSerial: ReturnType<typeof toSerializableSteps> = [];
  let toolCallCount = 0; // 中文注释：累计 assistant 工具调用次数
  let abortedByGuard = false; // 由工具调用次数上限主动中止
  let abortReason = '';
  try {
    // 中文注释：传入 recursionLimit 与 AbortSignal，保持 values 流模式。
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

        // 中文注释：守卫逻辑——统计工具调用步数（仅 assistant 且存在 toolCalls）。
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
          // 达到上限：中止后续流并在 finally/收尾阶段产出最终结果
          abortedByGuard = true;
          abortReason = `达到工具调用上限(${MAX_TOOL_CALLS})，为避免可能的循环已安全停止`;
          try { abortController.abort('tool-call-limit'); } catch {}
          break; // 结束当前批新增处理；for-await 将在下一轮抛出 AbortError
        }
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
    // 若因守卫触发中止，将视为“正常结束”并给出解释性最终结果
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
      return; // 吞掉异常，正常返回
    }
    // 识别外部取消：将取消视为“正常结束”，产出说明性最终结果，并尽可能保留最后上下文
    const aborted = (() => {
      // 适配不同实现：Error.name/message、signal.aborted、DOMException name。
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
      return; // 将取消视为正常收尾
    }

    // 其他异常：正常上报错误路径
    cbs.onError?.(err);
    throw err;
  }
}
