declare module '@mindforge/agent' {
  export type LLMMessage =
    | { role: 'system'; content: string }
    | { role: 'user'; content: string }
    | { role: 'assistant'; content: string };

  export function runReactAgent(messages: LLMMessage[], options?: { threadId?: string }): Promise<any>;

  export function startReactAgentStream(
    messages: LLMMessage[],
    options: { threadId?: string } | undefined,
    cbs: {
      onStep: (step: any) => void;
      onFinal: (result: any) => void;
      onError?: (err: unknown) => void;
    },
    externalAbortController?: AbortController,
  ): Promise<void>;
}
