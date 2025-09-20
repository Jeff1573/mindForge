declare module '@mindforge/shared' {
  export type AgentRole = 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'other';
  export interface AgentLogStep {
    id: string;
    index: number;
    role: AgentRole;
    summary: string;
    content: string;
    toolCalls?: unknown;
    toolCallId?: string;
    ts: number;
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    error?: string;
    raw?: string;
  }
  export interface AgentFinalResultEvent {
    type: 'final_result';
    id: string;
    content: string;
    format: 'markdown' | 'text';
    ts: number;
  }
  export interface AgentLogBatchResult {
    schemaVersion: number;
    steps: AgentLogStep[];
    finalResult?: AgentFinalResultEvent;
    systemPromptExcerpt?: string;
    events?: unknown[];
  }
  export const AGENT_LOG_SCHEMA_VERSION: number;
  export function createStepId(index: number, role: AgentRole): string;

  export type AIProvider = 'gemini' | 'google' | 'openai' | 'anthropic' | 'groq';
  export function getEnv(): {
    NODE_ENV: 'development' | 'test' | 'production';
    AI_PROVIDER: AIProvider;
    AI_MODEL?: string;
    AI_API_KEY?: string;
    AI_BASE_URL?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_USE_RESPONSES_API?: string;
    ANTHROPIC_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GROQ_API_KEY?: string;
    QDRANT_URL?: string;
    QDRANT_API_KEY?: string;
    QDRANT_COLLECTION: string;
  };
}

