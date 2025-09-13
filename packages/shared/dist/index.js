// src/env.ts
import "dotenv/config";
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
  AI_MODEL: z.string().min(1, "AI_MODEL \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  AI_API_KEY: z.string().min(1, "AI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  QDRANT_URL: z.string().url("QDRANT_URL \u5FC5\u987B\u4E3A\u5408\u6CD5 URL").optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default("docs"),
  MCP_SERVER_URL: z.string().optional(),
  MCP_API_KEY: z.string().optional()
});
var cachedEnv = null;
function getEnv() {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("[env] \u73AF\u5883\u53D8\u91CF\u6821\u9A8C\u5931\u8D25\uFF1A", parsed.error.flatten().fieldErrors);
    const partial = envSchema.parse({});
    cachedEnv = partial;
    return cachedEnv;
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}
function getPublicEnv() {
  const { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV } = getEnv();
  return { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV };
}

// src/logger.ts
var logger = {
  info: (...args) => console.log("[info]", ...args),
  warn: (...args) => console.warn("[warn]", ...args),
  error: (...args) => console.error("[error]", ...args)
};
export {
  envSchema,
  getEnv,
  getPublicEnv,
  logger
};
