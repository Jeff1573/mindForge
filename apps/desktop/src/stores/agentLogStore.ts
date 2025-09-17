/**
 * Agent 执行日志 Store（最小实现，无第三方依赖）。
 * - 作用：渲染进程内集中管理一次调用返回的结构化日志，供多个组件订阅。
 * - 约束：当前一次性写入（批量结果），后续如接入流式可按事件级 append。
 */
import type { AgentLogBatchResult, AgentLogStep, AgentFinalResultEvent } from '@mindforge/shared';

type Listener = () => void;

export type AgentLogState = {
  steps: AgentLogStep[];
  finalResult?: AgentFinalResultEvent;
  systemPromptExcerpt?: string;
};

const state: AgentLogState = { steps: [] };
const listeners = new Set<Listener>();

export function getAgentLogState(): AgentLogState {
  // 返回只读快照，避免外部直接修改内部对象
  return { steps: state.steps.slice(), finalResult: state.finalResult, systemPromptExcerpt: state.systemPromptExcerpt };
}

export function resetAgentLogState() {
  state.steps = [];
  state.finalResult = undefined;
  state.systemPromptExcerpt = undefined;
  emit();
}

export function setFromBatch(batch: AgentLogBatchResult) {
  state.steps = Array.isArray(batch.steps) ? batch.steps.slice() : [];
  state.finalResult = batch.finalResult;
  state.systemPromptExcerpt = batch.systemPromptExcerpt;
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const l of Array.from(listeners)) {
    try { l(); } catch { /* 忽略单个监听器错误，避免影响全局 */ }
  }
}

