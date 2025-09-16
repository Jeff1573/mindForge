export type LLMClient = {
  /** 核心对话调用，返回完整文本。 */
  invoke: (input: LLMInvokeParams) => Promise<LLMInvokeResult>;
  /** 预留流式输出，可选实现。 */
  stream?: (input: LLMStreamParams) => AsyncIterable<string> | Promise<AsyncIterable<string>>;
};

export type LLMInvokeParams = {
  messages: Array<LLMMessage>;
  options?: LLMCallOptions;
};

export type LLMInvokeResult = {
  /** 解析出的纯文本内容（若解析失败则为空字符串）。 */
  content: string;
  /** 原始模型返回，便于调用方调试或读取额外信息。 */
  raw?: unknown;
};

export type LLMStreamParams = LLMInvokeParams & {
  signal?: AbortSignal;
};

export type LLMMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

export type LLMCallOptions = {
  temperature?: number;
  maxTokens?: number;
};

export class LLMConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMConfigurationError';
  }
}

export class LLMProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`LLM Provider "${provider}" 尚未实现`);
    this.name = 'LLMProviderNotImplementedError';
  }
}
