import { getEnv } from '@mindforge/shared';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { BaseMessageLike } from '@langchain/core/messages';

import { loadRolePrompt } from '../../prompts/loader';
const calculatorTool = tool(
  async ({ expression }) => {
    const trimmed = expression.trim();
    if (!trimmed) throw new Error('expression 不能为空');
    const sanitized = trimmed.replace(/[^0-9+\-*/().\s]/g, '');
    if (sanitized !== trimmed) {
      throw new Error('仅支持数字与 +-*/() 运算符');
    }
    const finalExpression = sanitized.trim();
    if (!finalExpression) {
      throw new Error('表达式无有效内容');
    }
    const result = Function('"use strict"; return (' + finalExpression + ')')() as number;
    if (Number.isNaN(result) || !Number.isFinite(result)) {
      throw new Error('表达式计算结果无效');
    }
    return result.toString();
  },
  {
    name: 'calculator',
    description: '执行基础算术表达式，支持加减乘除与括号。',
    // 避免 TS 深层类型实例化导致的推断开销，显式放宽 schema 类型
    schema: z.object({ expression: z.string() })
  }
);

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
function createLLMFromEnv(): LanguageModelLike {
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
    configuration: baseURL ? { baseURL } : undefined
  });
}

// 中文注释：提供简单封装，确保全局只初始化一次 Agent。
export async function getReactAgent(): Promise<ReactAgent> {
  if (cachedAgent) return cachedAgent;
  const systemPrompt = await resolveAgentSystemPrompt();
  // 中文注释：使用 prompts 模块生成的 system prompt 作为 Agent 初始指令。
  const llm = createLLMFromEnv();
  // 避免 LangGraph 类型在 TS 下产生“类型实例化过深”的问题，结果做宽化处理。
  cachedAgent = createReactAgent({ llm, tools: [calculatorTool], prompt: systemPrompt });
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
