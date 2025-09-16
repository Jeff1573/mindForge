import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatGroqImport = typeof import('@langchain/groq');

type GroqClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
};

type GroqCallOptions = LLMCallOptions;

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_RETRIES = 2;

export async function createGroqClient(init: GroqClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.AI_API_KEY ?? env.GROQ_API_KEY;
  const baseURL = init.baseURL ?? env.AI_BASE_URL;
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) {
    throw new LLMConfigurationError('Groq 需配置 AI_API_KEY 或 GROQ_API_KEY');
  }
  if (!model) {
    throw new LLMConfigurationError('Groq 需配置模型名称 (AI_MODEL 或参数 model)');
  }

  const { ChatGroq } = await runtimeImport<ChatGroqImport>('@langchain/groq');

  const modelInstance = new ChatGroq({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxTokens: defaultMaxTokens,
    maxRetries,
    baseUrl: baseURL
  });

  const resolveCallOptions = (options?: GroqCallOptions) => {
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    const call: Record<string, unknown> = {};
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) {
      call.maxTokens = maxTokens;
      call.maxCompletionTokens = maxTokens;
      call.max_completion_tokens = maxTokens;
    }
    return call;
  };

  return {
    async invoke({ messages, options }) {
      const response = await modelInstance.invoke(toLangChainTuples(messages), resolveCallOptions(options));
      return {
        content: extractContentText(response.content),
        raw: response
      };
    },
    async stream({ messages, options, signal }) {
      const call = resolveCallOptions(options);
      if (signal) call.signal = signal;
      const stream = await modelInstance.stream(toLangChainTuples(messages), call);
      return asTextStream(stream as AsyncIterable<{ content: unknown }>);
    }
  };
}
