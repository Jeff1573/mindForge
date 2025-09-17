/**
 * MCP 工具结果通用规范化与上下文注入工具
 * - 目标：将标准 content[] 渲染为可读文本，并安全注入到 LLM 对话
 * - 约束：不内联图片二进制，仅输出 URI/提示；JSON 提供紧凑与缩进两种渲染
 * - 用法：
 *     const { text } = normalizeMcpToolResult(resp, { sourceLabel: 'context7.get-library-docs', maxChars: 3000 })
 *     const messages = buildMessagesWithContext({ prompt, context: text, placement: 'system' })
 */

// 最小通用类型（松散但有守卫）
export type MCPText = { type?: 'text'; text?: unknown };
export type MCPJson = { type?: 'json'; json?: unknown };
export type MCPImage = { type?: 'image'; mimeType?: unknown; data?: unknown; uri?: unknown; alt?: unknown };
export type MCPResource = { type?: 'resource' | 'file'; uri?: unknown; mimeType?: unknown; text?: unknown };
export type MCPAny = Record<string, unknown>;

export type MCPContentItem = MCPText | MCPJson | MCPImage | MCPResource | MCPAny;
export type MCPToolResult = { content?: MCPContentItem[] } | unknown;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function isTextBlock(v: MCPContentItem): v is MCPText {
  return isObj(v) && (v as MCPText).type === 'text' && typeof (v as MCPText).text === 'string';
}
function isJsonBlock(v: MCPContentItem): v is MCPJson {
  return isObj(v) && (v as MCPJson).type === 'json';
}
function isImageBlock(v: MCPContentItem): v is MCPImage {
  return (
    isObj(v) &&
    (v as MCPImage).type === 'image' &&
    (typeof (v as MCPImage).data === 'string' || typeof (v as MCPImage).uri === 'string')
  );
}
function isResourceBlock(v: MCPContentItem): v is MCPResource {
  return (
    isObj(v) &&
    (((v as MCPResource).type === 'resource' || (v as MCPResource).type === 'file') &&
      typeof (v as MCPResource).uri === 'string')
  );
}

export type NormalizeOptions = {
  maxChars?: number; // 软上限（字符数）；超过则裁剪
  jsonDepth?: number; // JSON 展开缩进深度
  compactJson?: boolean; // 是否优先输出紧凑 JSON
  sourceLabel?: string; // 头部来源标识
};

function prettyJson(val: unknown, depth = 2, compact = false): string {
  try {
    if (compact) return JSON.stringify(val);
    return JSON.stringify(val, null, Math.max(0, Math.min(6, depth)));
  } catch {
    try { return String(val); } catch { return ''; }
  }
}

function renderItem(it: MCPContentItem, opt: NormalizeOptions): string | null {
  if (isTextBlock(it)) return String((it as MCPText).text);
  if (isJsonBlock(it)) return prettyJson((it as MCPJson).json, opt.jsonDepth ?? 2, !!opt.compactJson);
  if (isResourceBlock(it)) {
    const { uri, mimeType } = it as MCPResource;
    return `[resource] ${String(uri)}${mimeType ? ` (${String(mimeType)})` : ''}`;
  }
  if (isImageBlock(it)) {
    const { uri, mimeType, alt } = it as MCPImage;
    const src = typeof uri === 'string' ? uri : '[embedded image]';
    return `[image] ${src}${mimeType ? ` (${String(mimeType)})` : ''}${alt ? ` — ${String(alt)}` : ''}`;
  }
  if (isObj(it)) {
    // 兜底：尝试常见字段；避免抛出序列化异常
    if (typeof (it as any).text === 'string') return (it as any).text as string;
    if ((it as any).json !== undefined) return prettyJson((it as any).json, 2, true);
    const type = typeof (it as any).type === 'string' ? (it as any).type : 'unknown';
    return `[${type}] ${prettyJson(it, 1, true)}`;
  }
  return null;
}

export function normalizeMcpToolResult(
  result: MCPToolResult,
  opt: NormalizeOptions = {}
): { text: string; truncated: boolean } {
  const items: MCPContentItem[] = isObj(result) && Array.isArray((result as any).content)
    ? ((result as any).content as MCPContentItem[])
    : [];

  const parts: string[] = [];
  for (const it of items) {
    const piece = renderItem(it, opt);
    if (piece) parts.push(piece);
  }
  let body = parts.join('\n').trim();
  const header = opt.sourceLabel ? `【源：${opt.sourceLabel}】\n` : '';
  const max = Math.max(200, opt.maxChars ?? 4000);
  let truncated = false;
  if (body.length > max) {
    body = `${body.slice(0, max)}\n[truncated: ${body.length - max} chars omitted]`;
    truncated = true;
  }
  return { text: `${header}${body}`, truncated };
}

// 简化的 LLM 消息类型（与项目内 LLMMessage 对齐）
export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export function buildMessagesWithContext(params: {
  prompt: string;
  context: string; // 来自 normalizeMcpToolResult
  placement?: 'system' | 'user-prepend' | 'user-append';
  systemPrefix?: string; // 自定义 system 前缀
}): LLMMessage[] {
  const placement = params.placement ?? 'system';
  const SYS_PREFIX =
    params.systemPrefix ?? '你将基于“工具上下文”回答问题。若上下文未覆盖，请明确说明并谨慎推断。';

  const user = { role: 'user' as const, content: params.prompt };
  const ctx = {
    role: placement === 'system' ? ('system' as const) : ('user' as const),
    content:
      placement === 'system'
        ? `${SYS_PREFIX}\n\n【工具上下文】\n${params.context}\n【/工具上下文】`
        : `【工具上下文】\n${params.context}\n【/工具上下文】`,
  };

  if (placement === 'user-prepend') return [ctx, user];
  if (placement === 'user-append') return [user, ctx];
  return [ctx, user];
}

