import { getLangChainModel } from '../factory';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { loadRolePrompt } from '../../prompts/loader';
import type { BaseMessageLike } from '@langchain/core/messages';

type ReactAgent = ReturnType<typeof createReactAgent>;
let cachedAgent: ReactAgent | null = null;
let cachedSystemPrompt: string | null = null;

// 统一解析系统提示词，减少重复 I/O
async function resolveAgentSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const { content } = await loadRolePrompt();
  cachedSystemPrompt = content;
  return cachedSystemPrompt;
}

// 无 MCP 版本 Agent（默认）
export async function getReactAgentWithoutMcp(): Promise<ReactAgent> {
  if (cachedAgent) return cachedAgent;
  const systemPrompt = await resolveAgentSystemPrompt();
  const llm = await getLangChainModel();
  cachedAgent = createReactAgent({ llm: llm, prompt: systemPrompt, tools: [] });
  return cachedAgent as ReactAgent;
}

export type ReactAgentInput = {
  messages: BaseMessageLike[];
};

export async function ensureAgentInput(messages: BaseMessageLike[]): Promise<ReactAgentInput> {
  if (!messages.length) {
    throw new Error('Agent 调用至少需要一条消息');
  }
  return { messages };
}

export async function getReactAgentSystemPrompt(): Promise<string> {
  return resolveAgentSystemPrompt();
}

