import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatOpenAIImport = typeof import('@langchain/openai');

type OpenAIClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
};

type OpenAICallOptions = LLMCallOptions;

// 中文注释：按需求设定 OpenAI 默认模型
const DEFAULT_MODEL = 'gpt-40-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createOpenAIClient(init: OpenAIClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  // 中文注释：在 openai provider 下，运行参数 > OPENAI_* > AI_*
  const model = init.model ?? env.OPENAI_MODEL ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.OPENAI_API_KEY ?? env.AI_API_KEY;
  // 基于优先级解析 baseURL：运行参数 > OPENAI_BASE_URL > AI_BASE_URL
  const baseURL = (init.baseURL ?? env.OPENAI_BASE_URL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) {
    throw new LLMConfigurationError('OpenAI 需配置 AI_API_KEY 或 OPENAI_API_KEY');
  }
  if (!model) {
    throw new LLMConfigurationError('OpenAI 需配置模型名称 (AI_MODEL 或参数 model)');
  }

  const { ChatOpenAI } = await runtimeImport<ChatOpenAIImport>('@langchain/openai');

  const modelInstance = new ChatOpenAI({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined
  });

  const resolveCallOptions = (options?: OpenAICallOptions) => {
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    const call: Record<string, unknown> = {};
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) {
      call.maxTokens = maxTokens;
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
