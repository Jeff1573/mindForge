import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';

type ChatAnthropicImport = typeof import('@langchain/anthropic');

export type AnthropicClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number | null;
  maxTokens?: number;
  maxRetries?: number;
};

type AnthropicCallOptions = LLMCallOptions & {
  /** 允许在单次调用层面显式覆盖 null 温度 */
  temperature?: number | null;
};

const DEFAULT_MODEL = 'claude-3-haiku-20240307';
const DEFAULT_TEMPERATURE: number | null = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createAnthropicClient(init: AnthropicClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.AI_API_KEY ?? env.ANTHROPIC_API_KEY;
  const baseURL = init.baseURL ?? env.AI_BASE_URL;
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (!apiKey) {
    throw new LLMConfigurationError('Anthropic 需配置 AI_API_KEY 或 ANTHROPIC_API_KEY');
  }
  if (!model) {
    throw new LLMConfigurationError('Anthropic 需配置模型名称 (AI_MODEL 或参数 model)');
  }

  const { ChatAnthropic } = await runtimeImport<ChatAnthropicImport>('@langchain/anthropic');

  const modelInstance = new ChatAnthropic({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxTokens: defaultMaxTokens,
    maxRetries,
    anthropicApiUrl: baseURL
  });

  const resolveCallOptions = (options?: AnthropicCallOptions) => {
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    const call: Record<string, unknown> = {};
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) {
      call.maxTokens = maxTokens;
      call.maxTokensToSample = maxTokens;
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
 * 返回 LangChain 的 `ChatAnthropic` 实例，供需要 `LanguageModelLike` 的调用方使用。
 * 与 `createAnthropicClient` 行为与环境解析保持一致。
 */
export async function createAnthropicLangChainModel(init: AnthropicClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.AI_API_KEY ?? env.ANTHROPIC_API_KEY;
  const anthropicApiUrl = init.baseURL ?? env.AI_BASE_URL;
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxTokens = init.maxTokens;

  if (!apiKey) throw new LLMConfigurationError('Anthropic 需配置 AI_API_KEY 或 ANTHROPIC_API_KEY');
  if (!model) throw new LLMConfigurationError('Anthropic 需配置模型名称 (AI_MODEL 或参数 model)');

  const { ChatAnthropic } = await runtimeImport<ChatAnthropicImport>('@langchain/anthropic');

  const DEBUG = String(process.env.LLM_DEBUG || '').trim() === '1';
  const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '*') : '');
  if (DEBUG) {
    const baseHint = anthropicApiUrl ?? '(默认 anthropic)';
    console.log(`[LLM] provider=anthropic model=${model} base=${baseHint} key=${mask(apiKey)}`);
  }

  return new ChatAnthropic({
    apiKey,
    model,
    temperature: temperature ?? undefined,
    maxTokens: maxTokens,
    maxRetries,
    anthropicApiUrl,
  });
}
