import { getEnv, type AIProvider } from '@mindforge/shared';
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
import { createOpenAIClient } from './providers/openai';
import { createAnthropicClient } from './providers/anthropic';
import { createGoogleClient } from './providers/google';
import { createGroqClient } from './providers/groq';
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

