// src/env.ts
import "dotenv/config";
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_PROVIDER: z.enum(["gemini", "google", "openai", "anthropic", "groq"]).default("gemini"),
  AI_MODEL: z.string().min(1, "AI_MODEL \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  AI_API_KEY: z.string().min(1, "AI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  AI_BASE_URL: z.string().url("AI_BASE_URL \u5FC5\u987B\u4E3A\u5408\u6CD5 URL").optional(),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  QDRANT_URL: z.string().url("QDRANT_URL \u5FC5\u987B\u4E3A\u5408\u6CD5 URL").optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default("docs")
  // MCP_SERVER_URL: z.string().optional(),
  // MCP_API_KEY: z.string().optional()
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

// src/agentLog.ts
var AGENT_LOG_SCHEMA_VERSION = 1;
function createStepId(index, role) {
  return `step-${index}-${role}-${Date.now()}`;
}
function isAgentLogBatchResult(x) {
  if (!x || typeof x !== "object") return false;
  const o = x;
  return o.schemaVersion === AGENT_LOG_SCHEMA_VERSION && Array.isArray(o.steps);
}
export {
  AGENT_LOG_SCHEMA_VERSION,
  createStepId,
  envSchema,
  getEnv,
  getPublicEnv,
  isAgentLogBatchResult,
  logger
};
