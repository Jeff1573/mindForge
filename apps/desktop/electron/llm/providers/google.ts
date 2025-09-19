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

type GoogleCallOptions = LLMCallOptions;

const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createGoogleClient(init: GoogleClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.AI_API_KEY ?? env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
  const baseURL = init.baseURL ?? env.AI_BASE_URL;
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) {
    throw new LLMConfigurationError('Google Gemini 需配置 AI_API_KEY、GOOGLE_API_KEY 或 GEMINI_API_KEY');
  }
  if (!model) {
    throw new LLMConfigurationError('Google Gemini 需配置模型名称 (AI_MODEL 或参数 model)');
  }

  const { ChatGoogleGenerativeAI } = await runtimeImport<ChatGoogleGenerativeAIImport>('@langchain/google-genai');

  const modelInstance = new ChatGoogleGenerativeAI({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxOutputTokens: defaultMaxTokens,
    maxRetries,
    baseUrl: baseURL
  });

  const resolveCallOptions = (options?: GoogleCallOptions) => {
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    const call: Record<string, unknown> = {};
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) {
      call.maxOutputTokens = maxTokens;
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

/**
 * 返回 LangChain 的 `ChatGoogleGenerativeAI` 实例（LanguageModelLike）。
 * 与 `createGoogleClient` 行为与参数保持一致。
 */
export async function createGoogleLangChainModel(init: GoogleClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.AI_API_KEY ?? env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
  const baseUrl = init.baseURL ?? env.AI_BASE_URL;
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxOutputTokens = init.maxTokens;

  if (!apiKey) throw new LLMConfigurationError('Google Gemini 需配置 AI_API_KEY、GOOGLE_API_KEY 或 GEMINI_API_KEY');
  if (!model) throw new LLMConfigurationError('Google Gemini 需配置模型名称 (AI_MODEL 或参数 model)');

  const { ChatGoogleGenerativeAI } = await runtimeImport<ChatGoogleGenerativeAIImport>('@langchain/google-genai');

  const DEBUG = String(process.env.LLM_DEBUG || '').trim() === '1';
  const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '*') : '');
  if (DEBUG) {
    const baseHint = baseUrl ?? '(默认 google-genai)';
    console.log(`[LLM] provider=google model=${model} base=${baseHint} key=${mask(apiKey)}`);
  }

  return new ChatGoogleGenerativeAI({
    apiKey,
    model,
    temperature,
    maxOutputTokens,
    maxRetries,
    baseUrl,
  });
}
