/**
 * 内容摘要工具：提取“一句话概括”。
 *
 * 设计目标（为何）：
 * - 将富文本/Markdown/多行内容压缩为单行、可读性强的摘要；
 * - 用于 Agent 步骤标题，避免冗长与噪声；
 * - 性能常数时间，不引入第三方库。
 *
 * 约束与边界：
 * - 仅做轻量正则与字符串处理；
 * - 不保证完整 Markdown 语义，仅清理常见标记（# * > ` []() ![ ] 等）；
 * - 输入为任意字符串，空/异常输入返回空字符串；
 * - 超长截断并以省略号（…）结尾。
 */
export function summarizeContent(raw: unknown, maxLen = 50): string {
  if (typeof raw !== 'string') return '';
  // 1) 预清洗：去除常见 Markdown 标记与多余空白
  let text = raw.trim();
  if (!text) return '';

  // 移除代码块围栏与行内反引号
  text = text.replace(/```[\s\S]*?```/g, ' '); // 多行 fenced code
  text = text.replace(/`([^`]|\\`)+`/g, ' ');  // 行内 code

  // 移除图片与链接的标记，仅保留可见文字
  // ![alt](url) 或 [text](url)
  text = text.replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^\)]*\)/g, '$1');

  // 移除标题/列表/引用的前缀符号
  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // # Heading
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // -/*/+ list
    .replace(/^\s{0,3}\d+\.\s+/gm, '') // numbered list
    .replace(/^\s{0,3}>\s+/gm, ''); // blockquote

  // 合并多余空白与换行，保留首行/首句
  text = text.replace(/[\t\f\r]+/g, ' ');
  text = text.replace(/\s*\n+\s*/g, ' ');
  text = text.replace(/\s{2,}/g, ' ').trim();

  if (!text) return '';

  // 取到第一个句号/问号/感叹号前的内容；若无，则用整段
  const firstSentenceMatch = text.match(/^[\s\S]*?[。！？!?\.](?=\s|$)/);
  const first = (firstSentenceMatch?.[0] || text).trim();

  // 截断
  if (first.length <= maxLen) return first;
  return first.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

/**
 * 安全连接工具名列表：`name1, name2 +N` 折叠格式。
 * - 边界：空数组返回空字符串；会自动去重/去空白。
 */
export function formatToolNames(names: string[], maxShown = 2): string {
  const uniq = Array.from(new Set((names || []).map((n) => (n || '').trim()).filter(Boolean)));
  if (uniq.length === 0) return '';
  if (uniq.length <= maxShown) return uniq.join(', ');
  const head = uniq.slice(0, maxShown).join(', ');
  return `${head} +${uniq.length - maxShown}`;
}

/**
 * 从多源结构中提取工具名。
 * 兼容：
 * - OpenAI style: { function: { name: string } }
 * - 通用: { name } / { toolName }
 * - LangChain 可能的包装：数组/对象混入
 */
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

/**
 * 构建“步骤标题”摘要（不含角色）。
 * 规则优先级：
 * 1) 存在工具调用：`step#N • 请求工具: name1, name2 +N`
 * 2) 工具结果（role=tool_result 或具备 toolCallId）：`step#N • 工具结果: 摘要`
 * 3) 其它：`step#N • 摘要`；若无摘要则仅 `step#N`
 */
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
    return `${prefix} • 请求工具: ${formatToolNames(names)}`;
  }
  const isToolResult = role === 'tool_result' || (typeof toolCallId === 'string' && toolCallId.length > 0);
  const brief = summarizeContent(typeof content === 'string' ? content : String(content ?? ''), maxLen);
  if (isToolResult && brief) return `${prefix} • 工具结果: ${brief}`;
  if (brief) return `${prefix} • ${brief}`;
  return prefix; // 按约定：内容为空时，仅显示步骤编号
}

