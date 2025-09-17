// 环境变量加载与校验（统一命名）
import 'dotenv/config';
import { z } from 'zod';

// 说明：为满足“先能跑”的目标，非关键项标记为可选。
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  AI_PROVIDER: z.enum(['gemini', 'google', 'openai', 'anthropic', 'groq']).default('gemini'),
  AI_MODEL: z.string().min(1, 'AI_MODEL 不能为空').optional(),
  AI_API_KEY: z.string().min(1, 'AI_API_KEY 不能为空').optional(),
  AI_BASE_URL: z.string().url('AI_BASE_URL 必须为合法 URL').optional(),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY 不能为空').optional(),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY 不能为空').optional(),
  GOOGLE_API_KEY: z.string().min(1, 'GOOGLE_API_KEY 不能为空').optional(),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY 不能为空').optional(),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY 不能为空').optional(),
  QDRANT_URL: z.string().url('QDRANT_URL 必须为合法 URL').optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default('docs'),
  // MCP_SERVER_URL: z.string().optional(),
  // MCP_API_KEY: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;
export type AIProvider = Env['AI_PROVIDER'];

let cachedEnv: Env | null = null;

/**
 * 加载并返回已校验的环境变量（带缓存）。
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // 仅打印友好错误，不抛出以便开发阶段继续启动
    console.warn('[env] 环境变量校验失败：', parsed.error.flatten().fieldErrors);
    // 返回默认/可选结果（含默认值）
    const partial = envSchema.parse({});
    cachedEnv = partial;
    return cachedEnv;
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * 仅返回可安全暴露给客户端的字段（避免泄露密钥）。
 */
export function getPublicEnv() {
  const { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV } = getEnv();
  return { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV } as const;
}
