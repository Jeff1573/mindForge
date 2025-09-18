// 说明：此模块负责在 Electron 主进程中加载角色系统提示词（prompts）。
// 需求与约束：
// - dev 场景下允许直接读取源码目录 `electron/prompts/*`（无需拷贝）。
// - build/打包后优先读取编译产物 `dist/prompts/*`。
// - 支持通过环境变量 `MF_PROMPTS_DIR` 覆盖（便于诊断/自定义）。
// - 错误信息需包含候选路径，便于排障。

import { promises as fsp } from 'fs';
import fs from 'fs';
import path from 'path';

export type RolePromptConfig = {
  id: string;
  name: string;
  description?: string;
  // 角色开场指令：支持两种来源（二选一，intro_file 优先）：
  // 1) intro_file：指向 PROMPT_ROOT 内的相对路径 Markdown 文件（推荐）
  // 2) intro：内联文本；或使用前缀“@file:<relpath>”引用文件（向后兼容）
  intro_file?: string;
  intro?: string;
  // 需要拼接的公共片段（common/*.md）
  fragments?: string[];
};

type RolePromptPayload = {
  role: RolePromptConfig;
  content: string;
};

const DEFAULT_ROLE_ID = 'default';
/**
 * 解析并返回可用的 prompts 根目录，优先级：
 * 1) 环境变量 MF_PROMPTS_DIR（支持相对路径，基于 CWD 解析）
 * 2) 编译产物目录：`dist/prompts`（即本文件编译后所在目录 `__dirname`）
 * 3) 源码目录：`electron/prompts`
 */
function resolvePromptRoot(): { root: string; chosen: string; candidates: string[] } {
  const candidates: string[] = [];
  const fromEnv = (process.env.MF_PROMPTS_DIR || '').trim();
  if (fromEnv) {
    // 允许传入相对路径（相对当前工作目录）或绝对路径
    const envPath = path.resolve(process.cwd(), fromEnv);
    candidates.push(envPath);
  }

  // 编译后本模块位于 dist/prompts，优先尝试该目录
  const distPrompts = __dirname;
  candidates.push(distPrompts);

  // 回退到源码目录（与 dist 同级的 electron/prompts）
  const srcPrompts = path.resolve(__dirname, '..', '..', 'electron', 'prompts');
  candidates.push(srcPrompts);

  // 校验目录是否符合期望结构（至少包含 roles 与 common 子目录）
  const isValidRoot = (p: string): boolean => {
    try {
      return (
        fs.existsSync(p) &&
        fs.existsSync(path.join(p, 'roles')) &&
        fs.existsSync(path.join(p, 'common'))
      );
    } catch {
      return false;
    }
  };

  for (const c of candidates) {
    if (isValidRoot(c)) {
      return { root: c, chosen: c, candidates };
    }
  }
  // 若没有任何可用目录，返回第一个候选用于错误信息拼接
  return { root: candidates[0] || distPrompts, chosen: '', candidates };
}

const { root: PROMPT_ROOT, chosen: CHOSEN_ROOT, candidates: CANDIDATES } = resolvePromptRoot();
const ROLES_DIR = path.join(PROMPT_ROOT, 'roles');
const COMMON_DIR = path.join(PROMPT_ROOT, 'common');

// 调试日志（仅在显式开启时输出），避免污染控制台
const DEBUG_PROMPTS = (process.env.DEBUG_PROMPTS === '1') || (process.env.MF_DEBUG === 'prompts');
if (DEBUG_PROMPTS) {
  console.log('[prompts] resolved root = %s', CHOSEN_ROOT || '(not found)');
  console.log('[prompts] candidates = %j', CANDIDATES);
}

// 缓存组合后的 prompt，避免重复磁盘读取
const promptCache = new Map<string, RolePromptPayload>();

function sanitizeRoleId(role?: string): string {
  if (!role) return DEFAULT_ROLE_ID;
  return role.trim() || DEFAULT_ROLE_ID;
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await fsp.access(filePath);
  } catch {
    // 包含候选路径，便于排障
    const hints = CANDIDATES.length ? `（候选根目录：${CANDIDATES.join(' | ')}）` : '';
    throw new Error(`未找到所需的 prompt 文件：${filePath}${hints}`);
  }
}

// 安全判断：target 必须在 root 目录内，防止越权访问
function assertInsideRoot(root: string, target: string): void {
  const normalizedRoot = path.resolve(root) + path.sep;
  const normalizedTarget = path.resolve(target);
  if (!normalizedTarget.startsWith(normalizedRoot) && normalizedTarget !== normalizedRoot.slice(0, -1)) {
    throw new Error(`尝试访问越权路径：${target}`);
  }
}

// 解析 intro 内容：优先 intro_file；其次 intro 里的 @file:；最后内联文本
async function resolveIntroContent(config: RolePromptConfig): Promise<string | undefined> {
  // 文件读取助手（限制在 PROMPT_ROOT 内）
  const readFromFile = async (relPath: string): Promise<string> => {
    const cleanRel = String(relPath).trim().replace(/^\/+/, '');
    const abs = path.resolve(PROMPT_ROOT, cleanRel);
    assertInsideRoot(PROMPT_ROOT, abs);
    await ensureFileExists(abs);
    const content = (await fsp.readFile(abs, 'utf8')).trim();
    if (!content) throw new Error(`intro 文件为空：${abs}`);
    return content;
  };

  if (config.intro_file && String(config.intro_file).trim()) {
    return readFromFile(String(config.intro_file));
  }

  if (config.intro) {
    const raw = String(config.intro).trim();
    const m = raw.match(/^@file\s*:\s*(.+)$/i);
    if (m) {
      const rel = m[1].trim();
      if (!rel) throw new Error('intro 的 @file: 路径为空');
      return readFromFile(rel);
    }
    return raw || undefined;
  }
  return undefined;
}

async function resolveRoleConfig(roleId: string): Promise<{ config: RolePromptConfig; filePath: string }> {
  const directPath = path.join(ROLES_DIR, `${roleId}.json`);
  try {
    await ensureFileExists(directPath);
    const content = await fsp.readFile(directPath, 'utf8');
    return { config: JSON.parse(content) as RolePromptConfig, filePath: directPath };
  } catch (err) {
    if (roleId === DEFAULT_ROLE_ID) throw err;
    const fallbackPath = path.join(ROLES_DIR, `${DEFAULT_ROLE_ID}.json`);
    await ensureFileExists(fallbackPath);
    const content = await fsp.readFile(fallbackPath, 'utf8');
    return { config: JSON.parse(content) as RolePromptConfig, filePath: fallbackPath };
  }
}

async function loadFragment(fragmentId: string): Promise<string> {
  const cleanId = fragmentId.replace(/\.md$/i, '');
  const filePath = path.join(COMMON_DIR, `${cleanId}.md`);
  await ensureFileExists(filePath);
  return fsp.readFile(filePath, 'utf8');
}

/**
 * 加载指定角色的系统提示词并拼接公共片段。
 * @param role 角色标识（缺省为 `default`）。
 * @returns {Promise<{ role: RolePromptConfig; content: string }>} 角色配置与最终拼接后的内容。
 */
export async function loadRolePrompt(role?: string): Promise<RolePromptPayload> {
  const targetRoleId = sanitizeRoleId(role);
  const cached = promptCache.get(targetRoleId);
  if (cached) return cached;

  const { config } = await resolveRoleConfig(targetRoleId);
  const fragments = config.fragments ?? [];

  const parts: string[] = [];
  // 读取 intro（文件优先，其次内联/引用）
  const intro = await resolveIntroContent(config);
  if (intro) parts.push(intro);

  for (const fragmentId of fragments) {
    const fragmentContent = await loadFragment(fragmentId);
    const trimmed = fragmentContent.trim();
    if (!trimmed) {
      throw new Error(`公共片段 ${fragmentId} 为空，无法拼接角色 prompt`);
    }
    parts.push(trimmed);
  }

  if (parts.length === 0) {
    throw new Error(`角色 ${config.id} 未提供 intro 或 fragments，请检查配置`);
  }

  const payload: RolePromptPayload = {
    role: config,
    content: parts.join('\n\n')
  };
  promptCache.set(targetRoleId, payload);
  return payload;
}

/**
 * 清空内存中的 prompts 缓存，便于热更新/调试。
 */
export function clearRolePromptCache(): void {
  promptCache.clear();
}

