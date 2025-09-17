/**
 * Agent 结构化日志协议（v1）。
 *
 * 设计目标：
 * - 以“步骤”为最小展示单元，满足大纲式折叠/展开；
 * - 支持最终结果（Markdown 完整渲染）单独面板；
 * - 允许逐步演进为流式事件（本版以批量/一次性为主，兼容 raw 文本兜底）。
 *
 * 注意：该文件位于 shared 包，供主进程（Electron）、渲染进程（React）与可能的 CLI 共享。
 */

export const AGENT_LOG_SCHEMA_VERSION = 1 as const;

/** 日志级别（用于异常高亮与筛选，预留）。 */
export type AgentLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** 角色类型，兼容 LLM 常见角色。 */
export type AgentRole = 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'other';

/**
 * 单个步骤（Step）的结构化数据。
 * - index 与 id 便于渲染层有稳定 key；
 * - summary 用于折叠头部的大纲文案；
 * - content 为步骤主要文本（已转为 string）；
 * - toolCalls/toolCallId 兼容工具调用展示；
 * - error 仅在该步骤失败时存在。
 */
export interface AgentLogStep {
  id: string;
  index: number;
  role: AgentRole;
  summary: string;
  content: string;
  toolCalls?: unknown;
  toolCallId?: string;
  ts: number; // 毫秒时间戳
  level?: AgentLogLevel;
  error?: string;
  raw?: string; // 兜底：原始文本
}

/** 最终结果（独立面板渲染 Markdown）。 */
export interface AgentFinalResultEvent {
  type: 'final_result';
  id: string;
  content: string; // Markdown 文本
  format: 'markdown' | 'text';
  ts: number;
}

/** 系统提示词摘要（可选，仅用于参考）。 */
export interface AgentSystemPromptExcerptEvent {
  type: 'system_prompt_excerpt';
  text: string;
  ts: number;
}

/** 错误事件。 */
export interface AgentErrorEvent {
  type: 'error';
  message: string;
  stack?: string;
  ts: number;
}

/** 结构化事件联合体（为未来流式而设）。 */
export type AgentLogEvent =
  | { type: 'step'; step: AgentLogStep }
  | AgentFinalResultEvent
  | AgentSystemPromptExcerptEvent
  | AgentErrorEvent;

/**
 * 一次调用的结构化日志结果（一次性返回）。
 * - 兼容当前非流式调用；
 * - 渲染层可直接基于 steps 做大纲，finalResult 单独面板；
 * - events 预留未来按需填充（如需要按时间线重放）。
 */
export interface AgentLogBatchResult {
  schemaVersion: typeof AGENT_LOG_SCHEMA_VERSION;
  steps: AgentLogStep[];
  finalResult?: AgentFinalResultEvent;
  systemPromptExcerpt?: string;
  events?: AgentLogEvent[];
}

/**
 * 公共工具：安全生成 step id（可在不同进程使用）。
 */
export function createStepId(index: number, role: AgentRole): string {
  return `step-${index}-${role}-${Date.now()}`;
}

/**
 * 类型守卫：判定是否为 AgentLogBatchResult。
 */
export function isAgentLogBatchResult(x: unknown): x is AgentLogBatchResult {
  if (!x || typeof x !== 'object') return false;
  const o = x as Partial<AgentLogBatchResult>;
  return (
    (o as any).schemaVersion === AGENT_LOG_SCHEMA_VERSION &&
    Array.isArray(o.steps)
  );
}

