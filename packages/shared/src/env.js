"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
exports.getEnv = getEnv;
exports.getPublicEnv = getPublicEnv;
// 环境变量加载与校验（统一命名）
require("dotenv/config");
const zod_1 = require("zod");
// 说明：为满足“先能跑”的目标，非关键项标记为可选。
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    AI_PROVIDER: zod_1.z.enum(['gemini', 'google', 'openai', 'anthropic', 'groq']).default('gemini'),
    AI_MODEL: zod_1.z.string().min(1, 'AI_MODEL 不能为空').optional(),
    AI_API_KEY: zod_1.z.string().min(1, 'AI_API_KEY 不能为空').optional(),
    AI_BASE_URL: zod_1.z.string().url('AI_BASE_URL 必须为合法 URL').optional(),
    OPENAI_API_KEY: zod_1.z.string().min(1, 'OPENAI_API_KEY 不能为空').optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().min(1, 'ANTHROPIC_API_KEY 不能为空').optional(),
    GOOGLE_API_KEY: zod_1.z.string().min(1, 'GOOGLE_API_KEY 不能为空').optional(),
    GEMINI_API_KEY: zod_1.z.string().min(1, 'GEMINI_API_KEY 不能为空').optional(),
    GROQ_API_KEY: zod_1.z.string().min(1, 'GROQ_API_KEY 不能为空').optional(),
    QDRANT_URL: zod_1.z.string().url('QDRANT_URL 必须为合法 URL').optional(),
    QDRANT_API_KEY: zod_1.z.string().optional(),
    QDRANT_COLLECTION: zod_1.z.string().default('docs'),
    // MCP_SERVER_URL: z.string().optional(),
    // MCP_API_KEY: z.string().optional()
});
let cachedEnv = null;
/**
 * 加载并返回已校验的环境变量（带缓存）。
 */
function getEnv() {
    if (cachedEnv)
        return cachedEnv;
    const parsed = exports.envSchema.safeParse(process.env);
    if (!parsed.success) {
        // 仅打印友好错误，不抛出以便开发阶段继续启动
        console.warn('[env] 环境变量校验失败：', parsed.error.flatten().fieldErrors);
        // 返回默认/可选结果（含默认值）
        const partial = exports.envSchema.parse({});
        cachedEnv = partial;
        return cachedEnv;
    }
    cachedEnv = parsed.data;
    return cachedEnv;
}
/**
 * 仅返回可安全暴露给客户端的字段（避免泄露密钥）。
 */
function getPublicEnv() {
    const { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV } = getEnv();
    return { AI_PROVIDER, AI_MODEL, QDRANT_COLLECTION, NODE_ENV };
}
//# sourceMappingURL=env.js.map