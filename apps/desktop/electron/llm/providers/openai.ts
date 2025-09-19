import { getEnv } from '@mindforge/shared';
import type { LLMCallOptions, LLMClient } from '../types';
import { LLMConfigurationError } from '../types';
import { runtimeImport, toLangChainTuples, extractContentText, asTextStream } from '../utils/langchain';
import { ChatOpenAI } from '@langchain/openai';

type ChatOpenAIImport = typeof import('@langchain/openai');

export type OpenAIClientInit = {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  useResponsesApi?: boolean; // 可选：强制使用 Responses API；默认 false（优先 Chat Completions）
};

type OpenAICallOptions = LLMCallOptions;

// 中文注释：按需求设定 OpenAI 默认模型
const DEFAULT_MODEL = 'gpt-4o-mini';;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export async function createOpenAIClient(init: OpenAIClientInit = {}): Promise<LLMClient> {
  const env = getEnv();
  // 规则：运行参数 > OPENAI_* > AI_*
  const model = init.model ?? env.OPENAI_MODEL ?? env.AI_MODEL ?? DEFAULT_MODEL;
  const apiKey = init.apiKey ?? env.OPENAI_API_KEY ?? env.AI_API_KEY;
  const baseURLRaw = (init.baseURL ?? env.OPENAI_BASE_URL ?? env.AI_BASE_URL)?.trim();
  const defaultTemperature = init.temperature ?? DEFAULT_TEMPERATURE;
  const defaultMaxTokens = init.maxTokens;
  const maxRetries = init.maxRetries ?? DEFAULT_MAX_RETRIES;
  const useResponsesApi =
    typeof init.useResponsesApi === 'boolean'
      ? init.useResponsesApi
      : parseBooleanFlag(String((env as any).OPENAI_USE_RESPONSES_API ?? '')) ?? false; // 默认为 Chat Completions

  if (!apiKey) {
    throw new LLMConfigurationError('OpenAI 需配置 AI_API_KEY 或 OPENAI_API_KEY');
  }
  if (!model) {
    throw new LLMConfigurationError('OpenAI 需配置模型名称 (OPENAI_MODEL / AI_MODEL 或参数 model)');
  }

  // 归一化并校验 baseURL：必须为绝对 URL；若误写到 /v1/chat/completions 或 /v1/responses，收敛为 /v1
  const baseURL = normalizeOpenAIBaseURL(baseURLRaw);

  // const { ChatOpenAI } = await runtimeImport<ChatOpenAIImport>('@langchain/openai');

  const modelInstance = new ChatOpenAI({
    apiKey,
    model, // 透传任意模型名（如代理的 gemini-*），不做品牌限定
    temperature: defaultTemperature,
    maxRetries,
    configuration: baseURL ? { baseURL } : undefined,
    // LangChain: useResponsesApi=true 走 /v1/responses；false 走 /v1/chat/completions
    useResponsesApi,
  });

  const resolveCallOptions = (options?: OpenAICallOptions) => {
    const temperature = options?.temperature ?? defaultTemperature;
    const maxTokens = options?.maxTokens ?? defaultMaxTokens;
    const call: Record<string, unknown> = {};
    if (temperature !== undefined) call.temperature = temperature;
    if (maxTokens !== undefined) {
      call.maxTokens = maxTokens; // Responses API
      call.maxOutputTokens = maxTokens; // Google 兼容
      // Chat Completions 对应字段是 max_tokens；LangChain 会内部适配
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

/**
 * 构建并返回 LangChain 的 `ChatOpenAI` 实例（供需要 `LanguageModelLike` 的调用方使用）。
 * - 统一从本 provider 解析环境与默认值，保持“单一事实源”。
 * - 与 `createOpenAIClient` 使用同一套参数与行为（含 Responses API 开关与 baseURL 归一化）。
 */
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

  if (!apiKey) throw new LLMConfigurationError('OpenAI 需配置 AI_API_KEY 或 OPENAI_API_KEY');
  if (!model) throw new LLMConfigurationError('OpenAI 需配置模型名称 (OPENAI_MODEL / AI_MODEL 或参数 model)');

  const baseURL = normalizeOpenAIBaseURL(baseURLRaw);
  // const { ChatOpenAI } = await runtimeImport<ChatOpenAIImport>('@langchain/openai');

  // 调试输出（脱敏），与旧逻辑保持一致
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

// -------- 内部工具：flag/baseURL 处理 --------
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
    // 为避免相对路径在不同上下文下解析成无效路由，这里强制绝对 URL
    throw new LLMConfigurationError(
      'OPENAI_BASE_URL 必须为绝对 URL，例如 https://api.openai.com/v1 或 http://your-proxy:port/v1'
    );
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch (_) {
    throw new LLMConfigurationError('OPENAI_BASE_URL 非法：无法解析为 URL');
  }
  // 去除多余末尾斜杠
  let pathname = u.pathname.replace(/\/+$/, '');
  // 将 /v1/chat/completions 或 /v1/responses 归一回 /v1（保留版本号）
  pathname = pathname.replace(/\/(chat\/completions|responses)$/i, '');
  return `${u.origin}${pathname || '/v1'}`;
}
