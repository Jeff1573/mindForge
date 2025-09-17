"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  envSchema: () => envSchema,
  getEnv: () => getEnv,
  getPublicEnv: () => getPublicEnv,
  logger: () => logger
});
module.exports = __toCommonJS(index_exports);

// src/env.ts
var import_config = require("dotenv/config");
var import_zod = require("zod");
var envSchema = import_zod.z.object({
  NODE_ENV: import_zod.z.enum(["development", "test", "production"]).default("development"),
  AI_PROVIDER: import_zod.z.enum(["gemini", "google", "openai", "anthropic", "groq"]).default("gemini"),
  AI_MODEL: import_zod.z.string().min(1, "AI_MODEL \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  AI_API_KEY: import_zod.z.string().min(1, "AI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  AI_BASE_URL: import_zod.z.string().url("AI_BASE_URL \u5FC5\u987B\u4E3A\u5408\u6CD5 URL").optional(),
  OPENAI_API_KEY: import_zod.z.string().min(1, "OPENAI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  ANTHROPIC_API_KEY: import_zod.z.string().min(1, "ANTHROPIC_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GOOGLE_API_KEY: import_zod.z.string().min(1, "GOOGLE_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GEMINI_API_KEY: import_zod.z.string().min(1, "GEMINI_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  GROQ_API_KEY: import_zod.z.string().min(1, "GROQ_API_KEY \u4E0D\u80FD\u4E3A\u7A7A").optional(),
  QDRANT_URL: import_zod.z.string().url("QDRANT_URL \u5FC5\u987B\u4E3A\u5408\u6CD5 URL").optional(),
  QDRANT_API_KEY: import_zod.z.string().optional(),
  QDRANT_COLLECTION: import_zod.z.string().default("docs")
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  envSchema,
  getEnv,
  getPublicEnv,
  logger
});
