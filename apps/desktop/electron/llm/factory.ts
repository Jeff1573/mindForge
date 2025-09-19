import { getEnv, type AIProvider } from '@mindforge/shared';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import {
  LLMConfigurationError,
  LLMProviderNotImplementedError,
  type LLMCallOptions,
  type LLMClient,
  type LLMInvokeParams,
  type LLMInvokeResult,
  type LLMMessage,
  type LLMStreamParams
} from './types';
import { createOpenAIClient, createOpenAILangChainModel } from './providers/openai';
import { createAnthropicClient, createAnthropicLangChainModel } from './providers/anthropic';
import { createGoogleClient, createGoogleLangChainModel } from './providers/google';
import { createGroqClient, createGroqLangChainModel } from './providers/groq';
import { runtimeImport, extractContentText } from './utils/langchain';
import { loadRolePrompt } from '../prompts/loader';

const clientCache: Partial<Record<string, LLMClient>> = {};

export type FactoryOptions = {
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  roleId?: string;
};

type ProviderInitOptions = Omit<FactoryOptions, 'provider' | 'roleId'>;

function validateMessages(messages: LLMMessage[]) {
  if (!messages?.length) {
    throw new LLMConfigurationError('LLM 调用至少需要一条消息');
  }
}

function shouldBypassCache(opts?: FactoryOptions) {
  if (!opts) return false;
  return Boolean(opts.model || opts.apiKey || opts.baseURL || opts.temperature || opts.maxTokens || opts.maxRetries);
}

function stripProvider(opts: FactoryOptions): ProviderInitOptions {
  const { provider: _provider, roleId: _roleId, ...rest } = opts;
  return rest;
}

// ========== LangChain Model 工厂 ==========
/**
 * 供需要 `LanguageModelLike` 的调用方（如 LangGraph Agent）使用。
 * - 基于 `AI_PROVIDER` 路由到各 provider 的 LangChain 模型构建器。
 * - `openaiUseResponsesApi` 仅在 provider=openai 时生效，其他提供商忽略。
 */
export type LangChainFactoryOptions = Omit<FactoryOptions, 'roleId'> & {
  openaiUseResponsesApi?: boolean;
};

export async function getLangChainModel(opts: LangChainFactoryOptions = {}): Promise<LanguageModelLike> {
  const env = getEnv();
  const provider = opts.provider ?? env.AI_PROVIDER;
  const init = { ...opts } as any;
  delete init.provider;
  delete init.roleId;

  switch (provider) {
    case 'openai':
      return createOpenAILangChainModel({ ...init, useResponsesApi: opts.openaiUseResponsesApi });
    case 'anthropic':
      return createAnthropicLangChainModel(init);
    case 'google':
    case 'gemini':
      return createGoogleLangChainModel(init);
    case 'groq':
      return createGroqLangChainModel(init);
    default:
      throw new LLMProviderNotImplementedError(provider);
  }
}

async function createClientFromEnv(provider: AIProvider, opts: FactoryOptions = {}): Promise<LLMClient> {
  const init = stripProvider(opts);
  switch (provider) {
    case 'openai':
      return createOpenAIClient(init);
    case 'anthropic':
      return createAnthropicClient(init);
    case 'google':
    case 'gemini':
      return createGoogleClient(init);
    case 'groq':
      return createGroqClient(init);
    default:
      throw new LLMProviderNotImplementedError(provider);
  }
}

export async function getLLMClient(opts: FactoryOptions = {}): Promise<LLMClient> {
  const env = getEnv();
  const provider = opts.provider ?? env.AI_PROVIDER;
  const bypassCache = shouldBypassCache(opts);

  if (!bypassCache) {
    const cached = clientCache[provider];
    if (cached) return cached;
  }

  const client = await createClientFromEnv(provider, opts);
  if (!bypassCache) {
    clientCache[provider] = client;
  }
  return client;
}

export async function invokeLLM(params: LLMInvokeParams, opts?: FactoryOptions): Promise<LLMInvokeResult> {
  validateMessages(params.messages);
  const client = await getLLMClient(opts);
  return client.invoke(params);
}

export async function streamLLM(
  params: LLMStreamParams,
  opts?: FactoryOptions
): Promise<AsyncIterable<string>> {
  validateMessages(params.messages);
  const client = await getLLMClient(opts);
  if (!client.stream) {
    const env = getEnv();
    const provider = opts?.provider ?? env.AI_PROVIDER;
    throw new LLMConfigurationError(`provider=${provider} 尚未实现流式输出`);
  }
  return client.stream(params);
}

export async function withPrompt(messages: LLMMessage[], options?: LLMCallOptions, opts?: FactoryOptions) {
  return invokeLLM({ messages, options }, opts);
}

export async function runPromptWithTemplate({
  roleId,
  system,
  template = '{q}',
  variables = {},
  options,
  factoryOptions
}: {
  roleId?: string;
  system?: string;
  template?: string;
  variables?: Record<string, string>;
  options?: LLMCallOptions;
  factoryOptions?: FactoryOptions;
}): Promise<LLMInvokeResult> {
  const { ChatPromptTemplate } = await runtimeImport<typeof import('@langchain/core/prompts')>(
    '@langchain/core/prompts'
  );

  const resolvedRoleId = roleId ?? factoryOptions?.roleId;
  let systemPrompt = system?.trim();

  if (!systemPrompt) {
    // 若未显式提供 system，则按角色加载集中配置
    const { content } = await loadRolePrompt(resolvedRoleId);
    systemPrompt = content;
  }

  const finalSystem = systemPrompt ?? '你是严谨的助手。';

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', finalSystem],
    ['human', template]
  ]);

  const promptValue = await prompt.formatPromptValue(variables);
  const chatMessages = promptValue.toChatMessages();
  const messages: LLMMessage[] = chatMessages
    .map((msg) => {
      const type = typeof (msg as any)._getType === 'function' ? (msg as any)._getType() : 'human';
      const content = extractContentText((msg as any).content ?? '');
      if (!content) return null;
      switch (type) {
        case 'system':
          return { role: 'system', content } as LLMMessage;
        case 'ai':
        case 'assistant':
          return { role: 'assistant', content } as LLMMessage;
        case 'human':
        case 'user':
        default:
          return { role: 'user', content } as LLMMessage;
      }
    })
    .filter((msg): msg is LLMMessage => Boolean(msg));

  return invokeLLM({ messages, options }, factoryOptions);
}

export async function invokeRawPrompt(prompt: string, opts?: FactoryOptions & { options?: LLMCallOptions }) {
  const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
  return invokeLLM({ messages, options: opts?.options }, opts);
}

