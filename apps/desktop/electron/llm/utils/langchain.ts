import type { LLMMessage } from '../types';

/**
 * 运行时动态导入 ESM-only 模块，避免被 TypeScript 转换成 require。
 */
export const runtimeImport = <T = unknown>(specifier: string): Promise<T> => {
  return (Function('s', 'return import(s)') as (s: string) => Promise<T>)(specifier);
};

const roleMap: Record<LLMMessage['role'], 'system' | 'human' | 'ai'> = {
  system: 'system',
  user: 'human',
  assistant: 'ai'
};

type LangChainTupleMessage = ['system' | 'human' | 'ai', string];

/**
 * 将内部消息结构映射为 LangChain tuple 格式。
 */
export function toLangChainTuples(messages: LLMMessage[]): LangChainTupleMessage[] {
  return messages.map((msg) => [roleMap[msg.role], msg.content] as LangChainTupleMessage);
}

/**
 * 解析 LangChain 消息或分片的 content 字段，提取文本。
 */
export function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content) return '';
  if (Array.isArray(content)) {
    return content.map((part) => extractContentText(part)).join('');
  }
  if (typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (record.content) return extractContentText(record.content);
  }
  return '';
}

/**
 * 将 LangChain 的流式分片映射为文本可迭代对象。
 */
export function asTextStream(stream: AsyncIterable<{ content: unknown }>): AsyncIterable<string> {
  return (async function* () {
    for await (const chunk of stream) {
      const maybeContent = (chunk as { content?: unknown }).content;
      const text = extractContentText(maybeContent);
      if (text) yield text;
    }
  })();
}
