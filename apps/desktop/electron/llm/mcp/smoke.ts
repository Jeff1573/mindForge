/**
 * MCP 自检与 Agent 交互脚本（可编译为 Node 可运行模块）
 * 使用方式（需先构建 Electron 主进程）：
 *   npm run build:electron --workspace=@mindforge/desktop
 *   node apps/desktop/scripts/mcp-smoke.cjs --id context7 --debug \
 *     --prompt "请用 context7 简述 Next.js 路由（30字内）"
 *
 * 设计要点：
 * - 直接使用 SdkMcpClient（经 McpSessionManager）对目标 MCP 列工具并调用典型工具：
 *   1) context7.resolve-library-id（入参 libraryName）
 *   2) context7.get-library-docs（入参 context7CompatibleLibraryID/tokens/topic）
 * - 如未指定 --id，将枚举所有 MCP（含 serena）并列出工具。
 * - 可选通过 ReAct Agent（LangGraph）进行一次中文交互，观察工具调用链路。
 */

import path from 'node:path';
import process from 'node:process';

import { getEnv } from '@mindforge/shared';
import { McpSessionManager } from '../../mcp/sessionManager';
import { resolveMcpConfigPath } from '../../mcp/config';
import { normalizeMcpToolResult, buildMessagesWithContext } from './contentUtils';
import { invokeLLM } from '../factory';

// 公共类型与参数
export type McpSmokeOptions = {
  id?: string; // 仅测试某个 MCP（如 context7 / serena）
  prompt?: string; // Agent 提示词
  skipAgent?: boolean; // 是否跳过 Agent 端到端交互
  debug?: boolean; // 输出详细日志
  configPath?: string; // mcp.json 路径（默认 apps/desktop/mcp.json 或 MF_MCP_CONFIG）
  libraryQuery?: string; // context7 库查询，如 "vercel/next.js"
  topic?: string; // context7 文档主题，如 "routing"
  maxDocTokens?: number; // context7 拉取文档 token 上限
  inject?: boolean; // 是否将工具结果注入上下文并单轮调用 LLM
  placement?: 'system' | 'user-prepend' | 'user-append'; // 注入位置
  maxCtxChars?: number; // 注入上下文的最大字符数
  systemPrefix?: string; // 注入 system 说明前缀
  agentOnly?: boolean; // 仅展示 Agent 路径（不跑直连验证）
};

type ListToolsResp = { tools?: Array<{ name?: string; description?: string }>; nextCursor?: string };

function isListToolsResp(v: unknown): v is ListToolsResp {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.tools !== undefined && !Array.isArray(o.tools)) return false;
  return true;
}

type McpContentItem =
  | { type?: 'text'; text?: unknown }
  | { type?: 'json'; json?: unknown }
  | { type?: string; [k: string]: unknown };

type McpToolResult = { content?: McpContentItem[] } | unknown;

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pick<T>(arr: T[], pred: (v: T) => boolean): T | undefined {
  for (const x of arr) if (pred(x)) return x;
  return undefined;
}

/**
 * 从 MCP 工具响应中尽力提取可读文本（支持 text/json 两类内容块）。
 */
function extractMcpText(resp: McpToolResult, debug = false): string {
  const items = (resp && typeof resp === 'object' && Array.isArray((resp as any).content)
    ? ((resp as any).content as McpContentItem[])
    : []) as McpContentItem[];
  const parts: string[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const t = (it as { type?: unknown }).type;
    if (t === 'text' && typeof (it as { text?: unknown }).text === 'string') {
      parts.push(String((it as any).text));
      continue;
    }
    // 宽松处理 JSON 内容：尽量序列化为字符串
    if (t === 'json') {
      const j = (it as { json?: unknown }).json;
      try { parts.push(JSON.stringify(j)); } catch { /* noop */ }
      continue;
    }
    // 其它类型尝试寻找可打印字段
    for (const key of ['text', 'data', 'value']) {
      const v = (it as Record<string, unknown>)[key];
      if (typeof v === 'string') { parts.push(v); break; }
    }
  }
  const text = parts.join('\n').trim();
  if (debug && !text) {
    // 在调试模式下，失败时打印原始结构摘要
    try { console.debug('[mcp-smoke][debug] raw tool result keys=', Object.keys((resp as any) ?? {})); } catch {}
  }
  return text;
}

/**
 * 尝试从文本或 JSON 字符串中解析 Context7 兼容库 ID（形如 "/org/project" 或 "/org/project/version"）。
 */
function detectContext7LibraryId(text: string): string | undefined {
  if (!text) return undefined;
  // 优先尝试解析为 JSON 并读取常见字段
  try {
    const obj = JSON.parse(text);
    const libs = Array.isArray((obj as any).libraries) ? (obj as any).libraries : undefined;
    if (libs && libs.length) {
      const id = libs[0]?.id ?? libs[0]?.context7CompatibleLibraryID ?? libs[0]?.context7Id;
      if (typeof id === 'string' && id.trim().length > 0) return id;
    }
    const id = (obj as any).context7CompatibleLibraryID ?? (obj as any).id;
    if (typeof id === 'string' && id.trim().length > 0) return id;
  } catch { /* 非 JSON，继续正则提取 */ }
  // 正则兜底：匹配 /org/name(/version)?
  const m = text.match(/\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/);
  return m?.[0];
}

/**
 * 在已列举工具中查找目标工具名（优先精确匹配，其次包含）。
 */
function findToolName(tools: Array<{ name?: string }>, candidates: string[]): string | undefined {
  const names = tools.map((t) => asString(t.name)?.trim()).filter((s): s is string => !!s);
  for (const c of candidates) {
    const exact = pick(names, (n) => n === c);
    if (exact) return exact;
  }
  for (const c of candidates) {
    const partial = pick(names, (n) => n.includes(c));
    if (partial) return partial;
  }
  return undefined;
}

function safeJSONStringify(obj: unknown, space = 2): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value as object)) return '[Circular]';
          seen.add(value as object);
        }
        return value;
      },
      space,
    );
  } catch {
    try { return String(obj); } catch { return '[Unserializable]'; }
  }
}

function logToolList(serverId: string, tools: Array<{ name?: string; description?: string }>) {
  console.log(`[#${serverId}][tools] 共 ${tools.length} 个工具：`);
  tools.forEach((t, i) => {
    const name = asString(t.name) ?? 'unknown';
    const desc = asString(t.description) ?? '';
    console.log(`  ${String(i + 1).padStart(2, ' ')}. ${name}${desc ? ` — ${desc}` : ''}`);
  });
}

async function listToolsAll(h: ReturnType<McpSessionManager['create']>, debug = false) {
  let cursor: string | undefined = undefined;
  const all: Array<{ name?: string; description?: string }> = [];
  do {
    const respUnknown: unknown = await h.client.listTools(cursor);
    const resp: ListToolsResp = isListToolsResp(respUnknown) ? respUnknown : {};
    const tools = Array.isArray(resp.tools) ? resp.tools : [];
    all.push(...tools);
    cursor = typeof resp.nextCursor === 'string' && resp.nextCursor.length > 0 ? resp.nextCursor : undefined;
  } while (cursor);
  // 总是打印 context7 的详细工具清单；其他 server 仅在 debug 下打印
  if (h.id === 'context7' || debug) {
    logToolList(h.id, all);
  }
  return all;
}

export async function runMcpSmoke(options: McpSmokeOptions = {}): Promise<void> {
  const env = getEnv();
  const provider = env.AI_PROVIDER; // 仅用于日志，具体模型在 Agent 内部处理

  const {
    id: onlyId,
    prompt = '请用 context7 工具简述 Next.js 路由（30字内）。',
    skipAgent = false,
    debug = false,
    configPath,
    libraryQuery = 'vercel/next.js',
    topic = 'routing',
    maxDocTokens = 800,
    inject = true,
    placement = 'system',
    maxCtxChars = 3000,
    systemPrefix,
    agentOnly = false,
  } = options;

  // 解析 mcp.json 路径：优先参数/环境变量；否则默认 apps/desktop/mcp.json
  const defaultCfg = path.resolve(__dirname, '../../mcp.json');
  const cfgPath = resolveMcpConfigPath(configPath ?? defaultCfg);
  if (!cfgPath) {
    console.error('[mcp-smoke] 未找到 mcp.json：请使用 --config 指定或设置环境变量 MF_MCP_CONFIG');
    throw new Error('mcp.json 缺失');
  }

  console.log(`[mcp-smoke] provider=${provider} config=${cfgPath}`);

  const mgr = new McpSessionManager();
  const handles = mgr.createFromConfig(cfgPath);
  const targets = onlyId ? handles.filter((h) => h.id === onlyId) : handles;
  if (targets.length === 0) {
    throw new Error('mcp.json 中没有匹配到目标配置');
  }

  // 启动 MCP 连接；若为 agentOnly，将尽量减少非必要输出
  for (const h of targets) {
    const t0 = Date.now();
    console.log(`\n\x1b[36m=== [${h.id}] connecting... ===\x1b[0m`);
    await h.start();
    const init = await h.initialize();
    const pv = init.protocolVersion ?? 'unknown';
    const info = init.serverInfo ?? { name: 'unknown', version: 'unknown' };
    console.log(`\x1b[2m[${h.id}] initialized: server=${info.name}@${info.version}, protocol=${pv}, elapsed=${Date.now() - t0}ms\x1b[0m`);
    if (!agentOnly) {
      const tools = await listToolsAll(h, debug);
      console.log(`\x1b[2m[${h.id}] tools total=${tools.length}\x1b[0m`);
    }
  }

  // 仅当非 agentOnly 时执行直连验证；agentOnly 则完全跳过
  if (!agentOnly) {
    const hContext = targets.find((h) => h.id === 'context7') ?? (onlyId ? undefined : handles.find((h) => h.id === 'context7'));
    if (hContext) {
      console.log(`\n[mcp-smoke] context7 自检：libraryQuery="${libraryQuery}", topic="${topic}"`);
      const tools = await listToolsAll(hContext, debug);
      const resolveName = findToolName(tools, ['resolve-library-id']);
      const docsName = findToolName(tools, ['get-library-docs']);
      if (!resolveName || !docsName) {
        console.warn('[mcp-smoke] 未发现 context7 所需工具（resolve-library-id/get-library-docs），跳过直连调用。');
      } else {
        // 直连调用（与前版本相同）
        const t1 = Date.now();
        let resolvedId: string | undefined;
        try {
          const args = { libraryName: libraryQuery } as const;
          console.log(`[context7][call] ${resolveName} args=${safeJSONStringify(args)}`);
          const resp = await hContext.client.callTool(resolveName, args as any);
          if (debug) {
            console.log(`[context7][result.raw] ${resolveName} content=`);
            console.log(safeJSONStringify((resp as any).content ?? resp, 2));
          }
          const text = extractMcpText(resp as McpToolResult, debug);
          const preview = text.length > 800 ? `${text.slice(0, 800)}…` : text;
          console.log(`[context7][result.text] ${resolveName} text=\n${preview || '[空内容]'}`);
          resolvedId = detectContext7LibraryId(text);
          console.log(`[context7][parsed] resolvedId=${resolvedId ?? '未解析到 ID'}`);
        } catch (err) {
          console.error('[context7] resolve-library-id 失败：', (err as Error)?.message ?? err);
        } finally {
          console.log(`[context7] resolve-library-id elapsed=${Date.now() - t1}ms`);
        }
        if (resolvedId) {
          const t2 = Date.now();
          try {
            const tokens = clamp(Number(maxDocTokens) || 800, 100, 4000);
            const args = { context7CompatibleLibraryID: resolvedId, tokens, topic } as const;
            console.log(`[context7][call] ${docsName} args=${safeJSONStringify(args)}`);
            const resp = await hContext.client.callTool(docsName, args as any);
            if (debug) {
              console.log(`[context7][result.raw] ${docsName} content=`);
              console.log(safeJSONStringify((resp as any).content ?? resp, 2));
            }
            const { text: ctxText } = normalizeMcpToolResult(resp as McpToolResult, {
              sourceLabel: `context7.get-library-docs(${topic})`,
              jsonDepth: 2,
              maxChars: maxCtxChars,
              compactJson: true,
            });
            const preview = ctxText.length > 800 ? `${ctxText.slice(0, 800)}…` : ctxText;
            console.log(`[context7][result.text] ${docsName} 规范化文本：\n${preview || '[空内容]'}`);
            if (inject) {
              const ask = prompt || '请用一句话概述所附上下文的主题要点。';
              console.log(`\n[mcp-smoke] 注入上下文并调用 LLM（placement=${placement}）`);
              const messages = buildMessagesWithContext({ prompt: ask, context: ctxText, placement, systemPrefix }) as any;
              const out = await invokeLLM({ messages }, { provider });
              console.log(`[inject] 输出：${out.content ?? '[空白]'}`);
            }
          } catch (err) {
            console.error('[context7] get-library-docs 失败：', (err as Error)?.message ?? err);
          } finally {
            console.log(`[context7] get-library-docs elapsed=${Date.now() - t2}ms`);
          }
        }
      }
    } else if (!onlyId) {
      console.warn('[mcp-smoke] 未配置或未选择 context7，跳过直连调用。');
    }
  }

  // serena 仅列工具（连通性）
  if (!agentOnly) {
    const hSerena = targets.find((h) => h.id === 'serena') ?? (onlyId ? undefined : handles.find((h) => h.id === 'serena'));
    if (hSerena) {
      console.log('\n[mcp-smoke] serena 自检：仅列出工具');
      await listToolsAll(hSerena, debug);
    }
  }

  // Agent 端到端（可选）
  if (!skipAgent || agentOnly) {
    try {
      const { runReactAgent } = await import('../reactAgentRunner');
      // 仅在 Agent 路径下按需过滤 MCP 加载集合（例如只加载 context7，避免 serena 日志）
      if (agentOnly && onlyId) {
        process.env.MF_MCP_INCLUDE = onlyId;
      }
      const messages = [{ role: 'user', content: prompt }];
      // 彩色分割线
      console.log(`\n\x1b[35m===== Agent Run (provider=${provider}) =====\x1b[0m`);
      const t3 = Date.now();
      const res = await runReactAgent(messages as any);
      // 渲染步骤（精简且高亮）
      renderAgentSteps(res.steps as any);
      // 最终回答
      console.log(`\n\x1b[32m[AGENT][FINAL]\x1b[0m ${res.finalResult?.content || '[空白]'}`);
      console.log(`\x1b[2m[AGENT] system prompt 摘要：${res.systemPromptExcerpt}\x1b[0m`);
      console.log(`\x1b[2m[AGENT] elapsed=${Date.now() - t3}ms\x1b[0m`);
    } catch (err) {
      console.error('[agent] 运行失败：', (err as Error)?.message ?? err);
    }
  } else {
    console.log('[mcp-smoke] 已按参数跳过 Agent 交互');
  }

  // 结束：停止所有会话
  for (const h of targets) {
    try { await h.stop(); } catch { /* noop */ }
  }
}

export default { runMcpSmoke };

// ========== 辅助：Agent 步骤渲染（带颜色） ==========
import type { AgentLogStep } from '@mindforge/shared';

function color(code: number, text: string) { return `\x1b[${code}m${text}\x1b[0m`; }
const C = {
  dim: (s: string) => color(2, s),
  cyan: (s: string) => color(36, s),
  magenta: (s: string) => color(35, s),
  yellow: (s: string) => color(33, s),
  green: (s: string) => color(32, s),
  red: (s: string) => color(31, s),
  bold: (s: string) => color(1, s),
};

function truncate(text: string, n = 800) {
  if (!text) return '';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

function renderAgentSteps(steps: AgentLogStep[] = []) {
  for (const s of steps) {
    const role = (s.role || 'assistant').toLowerCase();
    // tool_calls 结构：OpenAI 风格一般为数组，Google 可能不同；尽量宽松处理
    const toolCalls = Array.isArray(s.toolCalls) ? (s.toolCalls as any[]) : undefined;
    if (role === 'human' || role === 'user') {
      console.log(`\n${C.cyan('[USER]')} ${truncate(s.content)}`);
      continue;
    }
    if (toolCalls && toolCalls.length > 0) {
      for (const call of toolCalls) {
        const name = (call?.function?.name ?? call?.name ?? 'unknown') as string;
        const args = call?.function?.arguments ?? call?.arguments ?? {};
        console.log(`${C.magenta('[AGENT][TOOL.CALL]')} ${name} args=${safeJSONStringify(args)}`);
      }
      // 如果该条同时包含 assistant 的可读 content，也打印出来作为“思考/说明”
      if (s.content) {
        console.log(`${C.dim('[AGENT][THOUGHT]')} ${truncate(s.content, 400)}`);
      }
      continue;
    }
    // 工具结果（通常 role 为 tool，附带 toolCallId）
    if (role === 'tool' || s.toolCallId) {
      console.log(`${C.yellow('[AGENT][TOOL.RESULT]')} id=${s.toolCallId ?? '-'} ${truncate(s.content)}`);
      continue;
    }
    // 普通助手消息
    if (role === 'ai' || role === 'assistant') {
      if (s.content) {
        console.log(`${C.green('[AGENT][ASSISTANT]')} ${truncate(s.content)}`);
      }
      continue;
    }
    // 其它
    if (s.content) console.log(`${C.dim(`[${role}]`)} ${truncate(s.content)}`);
  }
}
