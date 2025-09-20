import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';
import { ChatOpenAI } from '@langchain/openai';

type ChatOpenAIImport = typeof import('@langchain/openai');

export type OpenAIClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  useResponsesApi?: boolean;
};

type OpenAICallOptions = LLMCallOptions;

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createOpenAIClient(init: OpenAIClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  const model = init.model ?? env.OPENAI_MODEL ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.OPENAI_API_KEY ?? env.AI_API_KEY;
  const baseURLRaw = (init.baseURL ?? env.OPENAI_BASE_URL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;
  const useResponsesApi =
    typeof init.useResponsesApi === 'boolean'
      ? init.useResponsesApi
      : parseBooleanFlag(String((env as any).OPENAI_USE_RESPONSES_API ?? '')) ?? false;

  if (!apiKey) throw new LLMConfigurationError('OpenAI 需要 AI_API_KEY 或 OPENAI_API_KEY');
  if (!model) throw new LLMConfigurationError('OpenAI 需要模型名称 (OPENAI_MODEL / AI_MODEL 或传参 model)');

  const baseURL = normalizeOpenAIBaseURL(baseURLRaw);

  const modelInstance = new ChatOpenAI({
    apiKey,
    model,
    temperature: defaultTemperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined,
    useResponsesApi,
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
      const response = await modelInstance.invoke(
        toLangChainTuples(messages),
        resolveCallOptions(options)
      );
      return {
        content: extractContentText(response.content),
        raw: response,
      };
    },
    async stream({ messages, options, signal }) {
      const call = resolveCallOptions(options);
      if (signal) call.signal = signal;
      const stream = await modelInstance.stream(toLangChainTuples(messages), call);
      return asTextStream(stream as AsyncIterable<{ content: unknown }>);
    },
  };
}

export async function createOpenAILangChainModel(init: OpenAIClientInit = {}) {
  const env = getEnv();
  const model = init.model ?? env.OPENAI_MODEL ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.OPENAI_API_KEY ?? env.AI_API_KEY;
  const baseURLRaw = (init.baseURL ?? env.OPENAI_BASE_URL ?? env.AI_BASE_URL)?.trim();
  const temperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;
  const useResponsesApi =
    typeof init.useResponsesApi === 'boolean'
      ? init.useResponsesApi
      : parseBooleanFlag(String((env as any).OPENAI_USE_RESPONSES_API ?? '')) ?? false;

  if (!apiKey) throw new LLMConfigurationError('OpenAI 需要 AI_API_KEY 或 OPENAI_API_KEY');
  if (!model) throw new LLMConfigurationError('OpenAI 需要模型名称 (OPENAI_MODEL / AI_MODEL 或传参 model)');

  const baseURL = normalizeOpenAIBaseURL(baseURLRaw);

  const DEBUG = String(process.env.LLM_DEBUG || '').trim() === '1';
  const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '*') : '');
  if (DEBUG) {
    const baseHint = baseURL ? new URL(baseURL).origin + new URL(baseURL).pathname : '(默认 openai)';
    console.log(`[LLM] provider=openai model=${model} base=${baseHint} key=${mask(apiKey)} mode=${useResponsesApi ? 'responses' : 'chat'}`);
  }

  const modelInstance = new ChatOpenAI({
    apiKey,
    model,
    temperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined,
    useResponsesApi,
  });
  return modelInstance;
}

function parseBooleanFlag(input?: string): boolean | undefined {
  if (input == null) return undefined;
  const v = String(input).trim().toLowerCase();
  if (!v) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

function normalizeOpenAIBaseURL(raw?: string): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (!/^https?:\/\//i.test(s)) {
    throw new LLMConfigurationError(
      'OPENAI_BASE_URL 必须为完整 URL，例如 https://api.openai.com/v1 或 http://proxy.local:port/v1'
    );
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new LLMConfigurationError('OPENAI_BASE_URL 非法，无法解析为 URL');
  }
  let pathname = u.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/(chat\/completions|responses)$/i, '');
  return `${u.origin}${pathname || '/v1'}`;
}

