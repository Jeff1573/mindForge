import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatGroqImport = typeof import('@langchain/groq');

export type GroqClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
};

const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createGroqClient(init: GroqClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.GROQ_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Groq 需要 API Key');

  const { ChatGroq } = await runtimeImport<ChatGroqImport>('@langchain/groq');
  const modelInstance = new ChatGroq({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined,
  } as any);

  const resolveCallOptions = (options?: LLMCallOptions) => {
    const call: Record<string, unknown> = {};
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) call.maxTokens = maxTokens;
    return call;
  };

  return {
    async invoke({ messages, options }) {
      const response = await modelInstance.invoke(toLangChainTuples(messages), resolveCallOptions(options));
      return { content: extractContentText(response.content), raw: response };
    },
    async stream({ messages, options }) {
      const stream = await modelInstance.stream(toLangChainTuples(messages), resolveCallOptions(options));
      return asTextStream(stream as AsyncIterable<{ content: unknown }>);
    },
  };
}

export async function createGroqLangChainModel(init: GroqClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.GROQ_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Groq 需要 API Key');

  const { ChatGroq } = await runtimeImport<ChatGroqImport>('@langchain/groq');
  const modelInstance = new ChatGroq({
    apiKey,
    model,
    temperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined,
  } as any);
  return modelInstance;
}
