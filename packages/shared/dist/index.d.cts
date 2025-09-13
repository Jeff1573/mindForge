import { z } from 'zod';

declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        test: "test";
        production: "production";
    }>>;
    AI_PROVIDER: z.ZodDefault<z.ZodEnum<{
        gemini: "gemini";
        openai: "openai";
    }>>;
    AI_MODEL: z.ZodOptional<z.ZodString>;
    AI_API_KEY: z.ZodOptional<z.ZodString>;
    QDRANT_URL: z.ZodOptional<z.ZodString>;
    QDRANT_API_KEY: z.ZodOptional<z.ZodString>;
    QDRANT_COLLECTION: z.ZodDefault<z.ZodString>;
    MCP_SERVER_URL: z.ZodOptional<z.ZodString>;
    MCP_API_KEY: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type Env = z.infer<typeof envSchema>;
/**
 * 加载并返回已校验的环境变量（带缓存）。
 */
declare function getEnv(): Env;
/**
 * 仅返回可安全暴露给客户端的字段（避免泄露密钥）。
 */
declare function getPublicEnv(): {
    readonly AI_PROVIDER: "gemini" | "openai";
    readonly AI_MODEL: string | undefined;
    readonly QDRANT_COLLECTION: string;
    readonly NODE_ENV: "development" | "test" | "production";
};

declare const logger: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
};

export { type Env, envSchema, getEnv, getPublicEnv, logger };
