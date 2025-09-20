#!/usr/bin/env node
// 用途：打印指定角色的 system prompt（仅静态拼接，不执行危险命令）
// 使用示例：
//   node scripts/print-prompt.cjs --role project-outliner              # 从源码目录拼接（默认）
//   node scripts/print-prompt.cjs --role default --dist               # 从构建产物 dist/prompts 拼接
//   MF_PROMPTS_DIR=./custom node scripts/print-prompt.cjs --role xxx  # 指定自定义 prompts 根目录
// 也可通过 npm：
//   npm run prompt:print --workspace=@mindforge/desktop -- --role project-outliner

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function usage(code = 0) {
  const help = [
    '打印指定角色的 system prompt（静态拼接 intro + fragments）',
    '',
    '参数：',
    '  --role <id>     角色 ID，默认：default',
    '  --src           使用源码目录（electron/prompts）（默认）',
    '  --dist          使用构建产物目录（dist/prompts）',
    '  --root <path>   指定 prompts 根目录（优先级最高，基于 CWD 解析）',
    '  --verbose       输出基本元信息头（id/name/长度）',
    '  -h, --help      显示帮助',
  ].join('\n');
  console.log(help);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { role: 'default', from: 'src', root: '', verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--role') args.role = String(argv[++i] || '').trim();
    else if (a === '--src') args.from = 'src';
    else if (a === '--dist') args.from = 'dist';
    else if (a === '--root') args.root = String(argv[++i] || '').trim();
    else if (a === '--verbose') args.verbose = true;
    else if (a === '-h' || a === '--help') usage(0);
    else if (a.startsWith('-')) { console.error('未知参数：', a); usage(1); }
  }
  if (!args.role) args.role = 'default';
  return args;
}

function fileExists(p) { try { return fs.existsSync(p); } catch { return false; } }

// 解析 prompts 根目录，优先级：--root > 环境变量 MF_PROMPTS_DIR > (--dist ? dist/prompts : electron/prompts)
function resolvePromptsRoot(opts) {
  const cwd = process.cwd();
  const appRoot = path.resolve(__dirname, '..');
  if (opts.root) return path.resolve(cwd, opts.root);
  const fromEnv = (process.env.MF_PROMPTS_DIR || '').trim();
  if (fromEnv) return path.resolve(cwd, fromEnv);
  if (opts.from === 'dist') return path.resolve(appRoot, 'dist/prompts');
  // 优先使用包内 prompts
  const pkgPrompts = path.resolve(appRoot, 'node_modules/@mindforge/agent/prompts');
  if (fs.existsSync(pkgPrompts)) return pkgPrompts;
  return path.resolve(appRoot, 'electron/prompts');
}

function assertInsideRoot(root, target) {
  const normalizedRoot = path.resolve(root) + path.sep;
  const normalizedTarget = path.resolve(target);
  if (!normalizedTarget.startsWith(normalizedRoot) && normalizedTarget !== normalizedRoot.slice(0, -1)) {
    throw new Error(`尝试访问越权路径：${target}`);
  }
}

async function readText(p) { return (await fsp.readFile(p, 'utf8')).trim(); }

async function buildPrompt(root, roleId) {
  const rolesDir = path.join(root, 'roles');
  const commonDir = path.join(root, 'common');
  const roleJson = path.join(rolesDir, `${roleId}.json`);
  if (!fileExists(roleJson)) throw new Error(`未找到角色文件：${roleJson}`);
  const cfg = JSON.parse(await readText(roleJson) || '{}');
  const parts = [];

  // 解析 intro：优先 intro_file；其次 intro 的 @file:；最后内联文本
  const introFile = (typeof cfg.intro_file === 'string' && cfg.intro_file.trim()) ? cfg.intro_file.trim() : '';
  if (introFile) {
    const abs = path.resolve(root, introFile.replace(/^\/+/, ''));
    assertInsideRoot(root, abs);
    if (!fileExists(abs)) throw new Error(`缺少 intro 文件：${abs}`);
    const s = await readText(abs);
    if (!s) throw new Error(`intro 文件为空：${abs}`);
    parts.push(s);
  } else if (typeof cfg.intro === 'string' && cfg.intro.trim()) {
    const raw = cfg.intro.trim();
    const m = raw.match(/^@file\s*:\s*(.+)$/i);
    if (m) {
      const rel = m[1].trim();
      const abs = path.resolve(root, rel.replace(/^\/+/, ''));
      assertInsideRoot(root, abs);
      if (!fileExists(abs)) throw new Error(`缺少 intro 文件：${abs}`);
      const s = await readText(abs);
      if (!s) throw new Error(`intro 文件为空：${abs}`);
      parts.push(s);
    } else {
      parts.push(raw);
    }
  }

  // 解析 fragments
  const frags = Array.isArray(cfg.fragments) ? cfg.fragments : [];
  for (const id of frags) {
    const fp = path.join(commonDir, `${String(id).replace(/\.md$/i, '')}.md`);
    if (!fileExists(fp)) throw new Error(`缺少公共片段：${fp}`);
    const s = await readText(fp);
    if (!s) throw new Error(`公共片段为空：${fp}`);
    parts.push(s);
  }

  const content = parts.join('\n\n');
  return { id: cfg.id || roleId, name: cfg.name || roleId, content };
}

(async () => {
  const opts = parseArgs(process.argv);
  const root = resolvePromptsRoot(opts);
  if (!fileExists(root)) throw new Error(`prompts 根目录不存在：${root}`);
  const { id, name, content } = await buildPrompt(root, opts.role);
  if (opts.verbose) {
    console.error(`===== [${id}] ${name} — length=${content.length} =====`);
  }
  // 默认只打印最终 system prompt 内容
  process.stdout.write(content + '\n');
})().catch((e) => {
  console.error('[print-prompt] 失败：', e.message || e);
  process.exit(1);
});
