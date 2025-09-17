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
  const provider = env.AI_PROVIDER;
  const modelName = env.AI_MODEL?.trim();
  if (provider === 'gemini' || provider === 'google') {
    const apiKey = env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY ?? env.AI_API_KEY;
    if (!apiKey) {
      throw new Error('未配置 GEMINI/GOOGLE_API_KEY / AI_API_KEY，无法初始化 Gemini 模型');
    }
    const llm = new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName || 'gemini-1.5-flash',
      temperature: 0,
      maxRetries: 2
    });
    return llm;
  }
  // 默认使用 OpenAI 兼容接口
  const apiKey = env.OPENAI_API_KEY ?? env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 OPENAI_API_KEY / AI_API_KEY，无法初始化 OpenAI 模型');
  }
  const baseURL = env.AI_BASE_URL?.trim();
  return new ChatOpenAI({
    apiKey,
    model: modelName || 'gpt-4o-mini',
    temperature: 0,
    maxRetries: 2,
    configuration: baseURL ? { baseURL } : undefined,
    // 用于 Remote MCP
    useResponsesApi: !!opts?.openAiUseResponsesApi,
  });
}

// 中文注释：提供简单封装，确保全局只初始化一次 Agent。
export async function getReactAgent(): Promise<ReactAgent> {
  if (cachedAgent) return cachedAgent;
  const systemPrompt = await resolveAgentSystemPrompt();
  console.log('systemPrompt', systemPrompt);
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
  const tools: any[] = [...mcp.localTools];

  cachedAgent = createReactAgent({ llm: llm as any, tools: tools as any, prompt: systemPrompt }) as any;
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


