import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatGoogleGenerativeAIImport = typeof import('@langchain/google-genai');

export type GoogleClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
};

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createGoogleClient(init: GoogleClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Google/Gemini 需要 API Key');

  const { ChatGoogleGenerativeAI } = await runtimeImport<ChatGoogleGenerativeAIImport>('@langchain/google-genai');
  const modelInstance = new ChatGoogleGenerativeAI({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxRetries,
    safetySettings: [],
    configuration: baseURL ? { baseURL } : undefined,
  } as any);

  const resolveCallOptions = (options?: LLMCallOptions) => {
    const call: Record<string, unknown> = {};
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) call.maxOutputTokens = maxTokens;
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

export async function createGoogleLangChainModel(init: GoogleClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Google/Gemini 需要 API Key');

  const { ChatGoogleGenerativeAI } = await runtimeImport<ChatGoogleGenerativeAIImport>('@langchain/google-genai');
  const modelInstance = new ChatGoogleGenerativeAI({
    apiKey,
    model,
    temperature,
    maxRetries,
    safetySettings: [],
    configuration: baseURL ? { baseURL } : undefined,
  } as any);
  return modelInstance;
}
