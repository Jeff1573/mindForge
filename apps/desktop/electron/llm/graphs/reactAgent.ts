/**
 * React Agent 构建与缓存（Electron 桌面 LLM 图）
 *
 * 作用与职责：
 * - 基于 LangGraph 预置的 createReactAgent 构建单例 Agent，缓存系统提示词与实例，
 *   降低重复 I/O 与初始化开销。
 * - 按环境变量动态选择并配置大模型（OpenAI 兼容或 Google Gemini），支持自定义 baseURL，
 *   以及在需要时启用 OpenAI Responses API（用于 Remote MCP）。
 * - 集成 MCP（Model Context Protocol）运行时：注入本地（stdio/http）工具；若底层 LLM 支持
 *   bindTools 且存在远程工具定义，则绑定远程工具（由 OpenAI 侧托管）。
 *
 * 对外导出：
 * - getReactAgent：获取已构建的单例 Agent。
 * - ensureAgentInput：校验消息输入格式，避免空消息调用。
 * - getReactAgentSystemPrompt：读取当前使用的系统提示词（便于调试与诊断）。
 *
 * 关键环境变量：AI_PROVIDER、AI_MODEL、OPENAI_API_KEY、GOOGLE_API_KEY、GEMINI_API_KEY、
 * AI_API_KEY、AI_BASE_URL；以及 mcp.json（定义远程/本地工具）。
 */
import { getEnv } from '@mindforge/shared';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { loadRolePrompt } from '../../prompts/loader';
import type { BaseMessageLike } from '@langchain/core/messages';

type ReactAgent = ReturnType<typeof createReactAgent>;
let cachedAgent: ReactAgent | null = null;
let cachedSystemPrompt: string | null = null;

// 中文注释：统一加载系统提示词并缓存，避免重复 I/O。

async function resolveAgentSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const { content } = await loadRolePrompt();
  cachedSystemPrompt = content;
  return cachedSystemPrompt;
}

// 中文注释：根据环境变量动态选择 LLM（OpenAI 或 Gemini）。
function createLLMFromEnv(opts?: { openAiUseResponsesApi?: boolean }): LanguageModelLike {
  const env = getEnv();
  const provider = (env.AI_PROVIDER || 'gemini').trim();

  // 可选：调试摘要（脱敏），通过 LLM_DEBUG=1 开关
  const DEBUG = String(process.env.LLM_DEBUG || '').trim() === '1';
  const mask = (s?: string) => (s ? s.replace(/.(?=.{4})/g, '*') : '');

  if (provider === 'openai') {
    // OpenAI 分支：仅在此分支支持 OPENAI_*；优先级 OPENAI_* > AI_*
    const apiKey = (env.OPENAI_API_KEY ?? env.AI_API_KEY) as string | undefined;
    if (!apiKey) throw new Error('未配置 OPENAI_API_KEY / AI_API_KEY，无法初始化 OpenAI 模型');
    const model = (env.OPENAI_MODEL ?? env.AI_MODEL ?? 'gpt-40-mini')!.trim();
    const baseURL = (env.OPENAI_BASE_URL ?? env.AI_BASE_URL)?.trim();

    if (DEBUG) {
      const baseHint = baseURL ? new URL(baseURL).origin + new URL(baseURL).pathname : '(默认 openai)';
      console.log(`[LLM] provider=openai model=${model} base=${baseHint} key=${mask(apiKey)}`);
    }
    return new ChatOpenAI({
      apiKey,
      model,
      temperature: 0,
      maxRetries: 2,
      configuration: baseURL ? { baseURL } : undefined,
      useResponsesApi: !!opts?.openAiUseResponsesApi,
    });
  }

  if (provider === 'gemini' || provider === 'google') {
    // Gemini/Google 分支：仅使用通用 AI_API_KEY/AI_MODEL，不读取 GOOGLE_API_KEY/GEMINI_API_KEY
    const apiKey = env.AI_API_KEY as string | undefined;
    if (!apiKey) throw new Error('未配置 AI_API_KEY，无法初始化 Gemini/Google 模型');
    const model = (env.AI_MODEL ?? 'gemini-1.5-flash').trim();
    if (DEBUG) console.log(`[LLM] provider=${provider} model=${model} key=${mask(apiKey)}`);
    return new ChatGoogleGenerativeAI({
      apiKey,
      model,
      temperature: 0,
      maxRetries: 2,
    });
  }

  // 其他提供商：按推荐暂未实现（避免引入新依赖/配置），提示用户调整
  throw new Error(`当前仅支持 AI_PROVIDER=openai 或 gemini/google。检测到: ${provider}`);
}

// 中文注释：提供简单封装，确保全局只初始化一次 Agent。
export async function getReactAgent(): Promise<ReactAgent> {
  if (cachedAgent) return cachedAgent;
  const systemPrompt = await resolveAgentSystemPrompt();
  // 依据 mcp.json 构建 MCP 集成（Remote MCP + 本地 stdio）
  const { ensureMcpRuntime } = await import('../mcp/runtime');
  const mcp = await ensureMcpRuntime();

  // OpenAI + Remote MCP 需要 useResponsesApi
  const llmBase = createLLMFromEnv({ openAiUseResponsesApi: mcp.needsResponsesApi });
  // 若存在 Remote MCP 定义且底层支持 bindTools，则绑定
  const llm = (typeof (llmBase as any).bindTools === 'function' && mcp.remoteDefs.length > 0)
    ? (llmBase as any).bindTools(mcp.remoteDefs)
    : llmBase;

  // 最小实现：仅将本地（stdio/http-本地）工具注入；Remote MCP 由 OpenAI 托管
  const tools = [...mcp.localTools];

  cachedAgent = createReactAgent({ llm: llm, tools: tools, prompt: systemPrompt });
  return cachedAgent as ReactAgent;
}

export type ReactAgentInput = {
  messages: BaseMessageLike[];
};

export async function ensureAgentInput(messages: BaseMessageLike[]): Promise<ReactAgentInput> {
  if (!messages.length) {
    throw new Error('Agent 调用必须包含至少一条消息');
  }
  return { messages };
}

// 中文注释：对外导出，便于运行器/诊断脚本获知当前 Agent 使用的系统提示词。
export async function getReactAgentSystemPrompt(): Promise<string> {
  return resolveAgentSystemPrompt();
}


