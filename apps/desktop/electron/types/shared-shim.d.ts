declare module '@mindforge/shared' {
  export const AGENT_LOG_SCHEMA_VERSION: number;
  export type AgentLogStep = {
    id: string;
    index: number;
    role: 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'other';
    summary: string;
    content: string;
    toolCalls?: unknown;
    toolCallId?: string;
    ts: number;
  };
  export type AgentLogBatchResult = {
    schemaVersion: number;
    steps: AgentLogStep[];
    finalResult?: { type: 'final_result'; id: string; content: string; format: 'markdown' | 'text'; ts: number };
    systemPromptExcerpt?: string;
    events?: unknown[];
  };
}
