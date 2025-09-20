import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatAnthropicImport = typeof import('@langchain/anthropic');

export type AnthropicClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
};

const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createAnthropicClient(init: AnthropicClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.ANTHROPIC_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Anthropic 需要 AI_API_KEY 或 ANTHROPIC_API_KEY');
  if (!model) throw new LLMConfigurationError('Anthropic 需要模型名称');

  const { ChatAnthropic } = await runtimeImport<ChatAnthropicImport>('@langchain/anthropic');
  const modelInstance = new ChatAnthropic({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxRetries,
    // Anthropic 客户端使用 anthropicApiUrl 配置基地址
    anthropicApiUrl: baseURL,
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

export async function createAnthropicLangChainModel(init: AnthropicClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.ANTHROPIC_API_KEY ?? env.AI_API_KEY;
  const baseURL = (init.baseURL ?? env.AI_BASE_URL)?.trim();
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) throw new LLMConfigurationError('Anthropic 需要 AI_API_KEY 或 ANTHROPIC_API_KEY');
  if (!model) throw new LLMConfigurationError('Anthropic 需要模型名称');

  const { ChatAnthropic } = await runtimeImport<ChatAnthropicImport>('@langchain/anthropic');
  const modelInstance = new ChatAnthropic({
    apiKey,
    model,
    temperature,
    maxRetries,
    anthropicApiUrl: baseURL,
  } as any);
  return modelInstance;
}
