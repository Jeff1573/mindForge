// MCP Runtime 单例：统一初始化/释放 LangChain mcp-adapters 侧客户端
// 设计动机：避免多 Agent 重复初始化与资源泄漏；在应用退出时集中 dispose。

import type { McpIntegrationResult } from './mcpIntegration';
import { resolveMcpForLangChain } from './mcpIntegration';

let cached: McpIntegrationResult | null = null;
let initPromise: Promise<McpIntegrationResult> | null = null;

function isDev(): boolean {
  // 不依赖项目自定义 env，直接依据 Vite/Electron 开发标志
  return !!process.env.VITE_DEV_SERVER_URL;
}

/**
 * 并发安全地初始化 MCP Runtime（只初始化一次）。
 * - 首次调用：读取 mcp.json，经适配后返回 { tools, dispose? }
 * - 后续调用：复用缓存；并发调用复用同一 promise。
 */
export async function ensureMcpRuntime(): Promise<McpIntegrationResult> {
  if (cached) return cached;
  if (initPromise) return initPromise;

  if (isDev()) console.log('[mcp-runtime] init start');
  initPromise = (async () => {
    const res = await resolveMcpForLangChain();
    cached = res;
    if (isDev()) console.log('[mcp-runtime] init ready', {
      tools: res.tools?.length ?? 0,
    });
    return res;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null; // 成功或失败都清空并发标记，便于下一次重试
  }
}

/** 获取已初始化的 Runtime，未初始化将抛错（提示先调用 ensure）。 */
export function getMcpRuntime(): McpIntegrationResult {
  if (!cached) {
    throw new Error('MCP Runtime 尚未初始化，请先调用 ensureMcpRuntime()');
  }
  return cached;
}

/**
 * 统一释放 Runtime；可重复调用（幂等）。
 * - 若初始化尚未完成，等待其完成后再尝试释放。
 * - 清理缓存，便于下次重新初始化（开发模式下窗口重载场景）。
 */
export async function disposeMcpRuntime(): Promise<void> {
  const pending = initPromise;
  const current = cached;
  initPromise = null;
  cached = null;

  try {
    if (pending && !current) {
      // 初始化进行中：等待结果再释放
      const res = await pending.catch(() => null);
      await res?.dispose?.().catch(() => {});
    } else {
      await current?.dispose?.().catch(() => {});
    }
  } finally {
    if (isDev()) console.log('[mcp-runtime] disposed');
  }
}

