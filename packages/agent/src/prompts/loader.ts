// 说明：作为独立包时的 prompts 加载器
// 策略：
// 1) 环境变量 MF_PROMPTS_DIR（可为相对/绝对路径；相对路径基于 CWD 解析）
// 2) 包内静态资源：node_modules/@mindforge/agent/prompts
//    通过 import.meta.url + fileURLToPath 定位包根并拼接 prompts
// 3) monorepo 源码路径（开发模式）：packages/agent/prompts

import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RolePromptConfig = {
  id: string;
  name: string;
  description?: string;
  intro_file?: string;
  intro?: string;
  fragments?: string[];
};

export type RolePromptPayload = {
  role: RolePromptConfig;
  content: string;
};

const DEFAULT_ROLE_ID = 'default';

/**
 * 基于候选顺序解析 prompts 根目录。
 * Node 文档依据：
 * - import.meta.url + fileURLToPath: 官方 ESM 相对资源定位方法。
 * - path.resolve: 生成绝对路径。
 */
function resolvePromptRoot(): { root: string; chosen: string; candidates: string[] } {
  const candidates: string[] = [];

  // 1) MF_PROMPTS_DIR（相对 CWD）
  const fromEnv = (process.env.MF_PROMPTS_DIR || '').trim();
  if (fromEnv) {
    candidates.push(path.resolve(process.cwd(), fromEnv));
  }

  // 2) 包内静态目录：从当前模块回溯到包根，再拼接 prompts
  // loader.ts -> dist/prompts/loader.js，回溯两级到包根
  const here = (() => {
    try {
      // ESM 情况下使用 import.meta.url
      // 证据：Node v22 ESM 文档（import.meta.url）
      return path.dirname(fileURLToPath(new URL(import.meta.url)));
    } catch {
      // CJS 构建（tsup cjs 输出）下，import.meta 不可用，回退到 __dirname
      // __dirname 指向 dist/prompts/loader.js 同级目录
      // 注意：打包后层级保持 dist/<subdirs>，上溯两级到包根
      // eslint-disable-next-line no-undef
      return typeof __dirname === 'string' ? __dirname : process.cwd();
    }
  })();
  const pkgRoot = path.resolve(here, '..', '..');
  candidates.push(path.join(pkgRoot, 'prompts'));

  // 3) monorepo 源码目录（开发）
  candidates.push(path.resolve(process.cwd(), 'packages', 'agent', 'prompts'));

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
    if (isValidRoot(c)) return { root: c, chosen: c, candidates };
  }
  return { root: candidates[0] || '', chosen: '', candidates };
}

const { root: PROMPT_ROOT, chosen: CHOSEN_ROOT, candidates: CANDIDATES } = resolvePromptRoot();
const ROLES_DIR = path.join(PROMPT_ROOT, 'roles');
const COMMON_DIR = path.join(PROMPT_ROOT, 'common');

const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === '1' || process.env.MF_DEBUG === 'prompts';
if (DEBUG_PROMPTS) {
  console.log('[prompts] resolved root = %s', CHOSEN_ROOT || '(not found)');
  console.log('[prompts] candidates = %j', CANDIDATES);
}

const promptCache = new Map<string, RolePromptPayload>();

function sanitizeRoleId(role?: string): string {
  if (!role) return DEFAULT_ROLE_ID;
  return role.trim() || DEFAULT_ROLE_ID;
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await fsp.access(filePath);
  } catch {
    const hints = CANDIDATES.length ? `（候选根：${CANDIDATES.join(' | ')}）` : '';
    throw new Error(`未找到所需的 prompt 文件：${filePath} ${hints}`);
  }
}

function assertInsideRoot(root: string, target: string): void {
  const normalizedRoot = path.resolve(root) + path.sep;
  const normalizedTarget = path.resolve(target);
  if (!normalizedTarget.startsWith(normalizedRoot) && normalizedTarget !== normalizedRoot.slice(0, -1)) {
    throw new Error(`拒绝访问越权路径：${target}`);
  }
}

async function resolveIntroContent(config: RolePromptConfig): Promise<string | undefined> {
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
 * 读取指定角色的系统提示词并拼接公共片段。
 */
export async function loadRolePrompt(role?: string): Promise<RolePromptPayload> {
  const targetRoleId = sanitizeRoleId(role);
  const cached = promptCache.get(targetRoleId);
  if (cached) return cached;

  const { config } = await resolveRoleConfig(targetRoleId);
  const fragments = config.fragments ?? [];

  const parts: string[] = [];
  const intro = await resolveIntroContent(config);
  if (intro) parts.push(intro);

  for (const fragmentId of fragments) {
    const fragmentContent = await loadFragment(fragmentId);
    const trimmed = fragmentContent.trim();
    if (!trimmed) {
      throw new Error(`片段 ${fragmentId} 为空，无法拼接角色 prompt`);
    }
    parts.push(trimmed);
  }

  if (parts.length === 0) {
    throw new Error(`角色 ${config.id} 未提供 intro 或 fragments`);
  }

  const payload: RolePromptPayload = { role: config, content: parts.join('\n\n') };
  promptCache.set(targetRoleId, payload);
  return payload;
}

export function clearRolePromptCache(): void {
  promptCache.clear();
}
