import { promises as fs } from 'fs';
import path from 'path';

export type RolePromptConfig = {
  id: string;
  name: string;
  description?: string;
  intro?: string;
  fragments?: string[];
};

type RolePromptPayload = {
  role: RolePromptConfig;
  content: string;
};

const DEFAULT_ROLE_ID = 'default';
const PROMPT_ROOT = __dirname;
const ROLES_DIR = path.join(PROMPT_ROOT, 'roles');
const COMMON_DIR = path.join(PROMPT_ROOT, 'common');

// 缓存组合后的 prompt，避免重复磁盘读取
const promptCache = new Map<string, RolePromptPayload>();

function sanitizeRoleId(role?: string): string {
  if (!role) return DEFAULT_ROLE_ID;
  return role.trim() || DEFAULT_ROLE_ID;
}

async function ensureFileExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`未找到所需的 prompt 文件：${filePath}`);
  }
}

async function resolveRoleConfig(roleId: string): Promise<{ config: RolePromptConfig; filePath: string }> {
  const directPath = path.join(ROLES_DIR, `${roleId}.json`);
  try {
    await ensureFileExists(directPath);
    const content = await fs.readFile(directPath, 'utf8');
    return { config: JSON.parse(content) as RolePromptConfig, filePath: directPath };
  } catch (err) {
    if (roleId === DEFAULT_ROLE_ID) throw err;
    const fallbackPath = path.join(ROLES_DIR, `${DEFAULT_ROLE_ID}.json`);
    await ensureFileExists(fallbackPath);
    const content = await fs.readFile(fallbackPath, 'utf8');
    return { config: JSON.parse(content) as RolePromptConfig, filePath: fallbackPath };
  }
}

async function loadFragment(fragmentId: string): Promise<string> {
  const cleanId = fragmentId.replace(/\.md$/i, '');
  const filePath = path.join(COMMON_DIR, `${cleanId}.md`);
  await ensureFileExists(filePath);
  return fs.readFile(filePath, 'utf8');
}

export async function loadRolePrompt(role?: string): Promise<RolePromptPayload> {
  const targetRoleId = sanitizeRoleId(role);
  const cached = promptCache.get(targetRoleId);
  if (cached) return cached;

  const { config } = await resolveRoleConfig(targetRoleId);
  const fragments = config.fragments ?? [];

  const parts: string[] = [];
  if (config.intro) parts.push(config.intro.trim());

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

export function clearRolePromptCache(): void {
  promptCache.clear();
}




