/**
 * 内容摘要器：取首句或截断。
 * 约束与边界：
 * - 尽量去除 Markdown 标记；
 * - 输入非字符串/异常时返回空字符串；
 */
export function summarizeContent(raw: unknown, maxLen = 50): string {
  if (typeof raw !== 'string') return '';
  // 1) 预清洗：去除代码块与多余空白
  let text = raw.trim();
  if (!text) return '';

  text = text.replace(/```[\s\S]*?```/g, ' '); // fenced code
  text = text.replace(/`([^`]|\\`)+`/g, ' '); // inline code
  text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, ' '); // images
  text = text.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1'); // links
  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/^\s{0,3}>\s+/gm, '');
  text = text.replace(/[\t\f\r]+/g, ' ');
  text = text.replace(/\s*\n+\s*/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();
  if (!text) return '';

  const firstSentenceMatch = text.match(/^[\s\S]*?[。！？!.](?=\s|$)/);
  const first = (firstSentenceMatch?.[0] || text).trim();
  if (first.length <= maxLen) return first;
  return first.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

export function formatToolNames(names: string[], maxShown = 2): string {
  const uniq = Array.from(new Set((names || []).map((n) => (n || '').trim()).filter(Boolean)));
  if (uniq.length === 0) return '';
  if (uniq.length <= maxShown) return uniq.join(', ');
  const head = uniq.slice(0, maxShown).join(', ');
  return `${head} +${uniq.length - maxShown}`;
}

export function extractToolNames(toolCalls: unknown): string[] {
  const out: string[] = [];
  const readName = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    const fn = (obj as any).function;
    if (fn && typeof fn.name === 'string' && fn.name) { out.push(fn.name); return; }
    if (typeof obj.name === 'string' && obj.name) { out.push(obj.name); return; }
    if (typeof obj.toolName === 'string' && obj.toolName) { out.push(obj.toolName); return; }
  };
  if (Array.isArray(toolCalls)) {
    for (const item of toolCalls) readName(item);
  } else if (toolCalls && typeof toolCalls === 'object') {
    readName(toolCalls as any);
  }
  return Array.from(new Set(out));
}

export function buildStepSummaryTitle(
  index: number,
  role: string,
  content: unknown,
  toolCalls?: unknown,
  toolCallId?: unknown,
  maxLen = 50,
): string {
  const prefix = `step#${index}`;
  const names = extractToolNames(toolCalls);
  if (names.length > 0) {
    return `${prefix} · 调用工具: ${formatToolNames(names)}`;
    }
  const isToolResult = role === 'tool_result' || (typeof toolCallId === 'string' && toolCallId.length > 0);
  const brief = summarizeContent(typeof content === 'string' ? content : String(content ?? ''), maxLen);
  if (isToolResult && brief) return `${prefix} · 工具结果: ${brief}`;
  if (brief) return `${prefix} · ${brief}`;
  return prefix;
}

