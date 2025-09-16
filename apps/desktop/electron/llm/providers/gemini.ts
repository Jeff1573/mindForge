/**
 * 中文说明：Gemini Provider（Electron 主进程）
 * - 目标：在主进程通过 LangChain 的 ChatGoogleGenerativeAI 建立到 Gemini 的连接，
 *   支持流式输出（最小可用）。
 * - 约定：读取环境变量 GOOGLE_API_KEY；默认使用模型 `gemini-2.5-flash`。
 * - 兼容性：当前 Electron 主进程编译为 CommonJS；LangChain 为 ESM-only。
 *   为避免 CJS/ESM 冲突，这里使用 runtime dynamic import（Function('return import()')）
 *   来按需加载 ESM 包，避免 TypeScript 在 CJS 下将 import() 降级为 require()。
 */

import type { AIMessageChunk } from '@langchain/core/messages';
import type { ChatGoogleGenerativeAI as ChatGoogleGenerativeAIType } from '@langchain/google-genai';

// 动态导入工具：避免在 CJS 编译下被 TS 转换为 require()
const dynamicImport: (specifier: string) => Promise<unknown> = (specifier) =>
  (Function('s', 'return import(s)') as (s: string) => Promise<unknown>)(specifier);

export type GeminiInitOptions = {
  /** 默认模型，用户未提供时采用 `gemini-2.5-flash` */
  model?: string;
  /** 温度，默认 0.2 */
  temperature?: number;
  /** 最大重试次数，默认 2 */
  maxRetries?: number;
};

/**
 * 创建 Gemini Chat 模型实例。
 * 说明：不直接静态导入，以兼容 CJS 主进程。
 */
export async function createGeminiModel(opts: GeminiInitOptions = {}): Promise<ChatGoogleGenerativeAIType> {
  const { model = 'gemini-2.5-flash', temperature = 0.2, maxRetries = 2 } = opts;

  if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY.trim().length === 0) {
    throw new Error('[Gemini] 缺少 GOOGLE_API_KEY 环境变量');
  }

  // 运行时按需加载 ESM 模块
  const mod = (await dynamicImport('@langchain/google-genai')) as {
    ChatGoogleGenerativeAI: typeof ChatGoogleGenerativeAIType;
  };
  const { ChatGoogleGenerativeAI } = mod;

  // ChatGoogleGenerativeAI 会默认读取 process.env.GOOGLE_API_KEY
  const modelInstance = new ChatGoogleGenerativeAI({
    model,
    temperature,
    maxRetries,
  });

  return modelInstance as ChatGoogleGenerativeAIType;
}

/**
 * 流式输出：返回一个逐步产出文本片段的异步可迭代对象。
 * 使用 LangChain `.stream(...)`，并将 chunk 拼成字符串片段。
 */
export async function streamText(
  prompt: string,
  opts?: GeminiInitOptions,
  runtime?: { signal?: AbortSignal }
): Promise<AsyncIterable<string>> {
  const model = await createGeminiModel(opts);

  // LangChain Chat 模型接受字符串或对话消息数组；
  // 这里使用字符串作为最小可用输入。
  const stream = await model.stream(prompt, { signal: runtime?.signal });

  // 适配器：将 AIMessageChunk => string
  async function* mapChunks() {
    for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
      const c = chunk?.content as unknown;
      if (typeof c === 'string') {
        if (c) yield c;
      } else if (Array.isArray(c)) {
        // 某些模型会返回分片的 message parts，这里做一次容错拼接
        type Part = { text?: unknown } | string | Record<string, unknown>;
        const text = (c as Part[])
          .map((part) => {
            if (typeof part === 'string') return part;
            const maybeText = (part as Record<string, unknown>).text;
            if (typeof maybeText === 'string') return maybeText;
            return '';
          })
          .join('');
        if (text) yield text;
      } else if (c && typeof c === 'object' && 'text' in (c as Record<string, unknown>)) {
        const text = String((c as Record<string, unknown>).text ?? '');
        if (text) yield text;
      }
    }
  }

  return mapChunks();
}

/**
 * Smoke：在控制台验证一次流式生成（仅主进程内部调用）。
 * 受环境变量 `LLM_SMOKE=1` 控制是否执行。
 */
export async function runGeminiSmoke() {
  const mod = (await dynamicImport('../smoke')) as typeof import('../smoke');
  await mod.runLLMSmoke({ provider: 'gemini', force: true });
}
