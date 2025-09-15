import { z } from 'zod';

declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "test", "production"]>>;
    AI_PROVIDER: z.ZodDefault<z.ZodEnum<["gemini", "openai"]>>;
    AI_MODEL: z.ZodOptional<z.ZodString>;
    AI_API_KEY: z.ZodOptional<z.ZodString>;
    QDRANT_URL: z.ZodOptional<z.ZodString>;
    QDRANT_API_KEY: z.ZodOptional<z.ZodString>;
    QDRANT_COLLECTION: z.ZodDefault<z.ZodString>;
    MCP_SERVER_URL: z.ZodOptional<z.ZodString>;
    MCP_API_KEY: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "test" | "production";
    AI_PROVIDER: "gemini" | "openai";
    QDRANT_COLLECTION: string;
    AI_MODEL?: string | undefined;
    AI_API_KEY?: string | undefined;
    QDRANT_URL?: string | undefined;
    QDRANT_API_KEY?: string | undefined;
    MCP_SERVER_URL?: string | undefined;
    MCP_API_KEY?: string | undefined;
}, {
    NODE_ENV?: "development" | "test" | "production" | undefined;
    AI_PROVIDER?: "gemini" | "openai" | undefined;
    AI_MODEL?: string | undefined;
    AI_API_KEY?: string | undefined;
    QDRANT_URL?: string | undefined;
    QDRANT_API_KEY?: string | undefined;
    QDRANT_COLLECTION?: string | undefined;
    MCP_SERVER_URL?: string | undefined;
    MCP_API_KEY?: string | undefined;
}>;
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
