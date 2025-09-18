// 目的：构建后快速校验 dist/prompts 是否包含必要文件
// 使用：node apps/desktop/scripts/check-prompts.cjs

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function fileExists(p) { try { return fs.existsSync(p); } catch { return false; } }

async function main() {
  const root = path.resolve(__dirname, '..');
  const dist = path.resolve(root, 'dist/prompts');
  const rolesDir = path.join(dist, 'roles');
  const commonDir = path.join(dist, 'common');

  const problems = [];

  if (!fileExists(dist)) problems.push(`缺少目录：${dist}`);
  if (!fileExists(rolesDir)) problems.push(`缺少目录：${rolesDir}`);
  if (!fileExists(commonDir)) problems.push(`缺少目录：${commonDir}`);

  // 遍历所有角色并校验：fragments 存在、intro_file 或 @file 引用存在且非空
  let roleFiles = [];
  try {
    roleFiles = (await fsp.readdir(rolesDir)).filter((n) => n.endsWith('.json'));
  } catch {}

  if (roleFiles.length === 0) {
    problems.push(`未发现任何角色 JSON：${rolesDir}`);
  }

  const readText = async (p) => {
    try { return (await fsp.readFile(p, 'utf8')).trim(); } catch { return ''; }
  };

  for (const name of roleFiles) {
    const p = path.join(rolesDir, name);
    try {
      const cfg = JSON.parse(await fsp.readFile(p, 'utf8'));
      const frags = Array.isArray(cfg.fragments) ? cfg.fragments : [];
      for (const id of frags) {
        const fp = path.join(commonDir, `${String(id).replace(/\.md$/i, '')}.md`);
        if (!fileExists(fp)) problems.push(`缺少公共片段：${fp}（角色：${name}）`);
      }

      // intro 文件优先
      let introPath = '';
      if (typeof cfg.intro_file === 'string' && cfg.intro_file.trim()) {
        introPath = path.resolve(dist, cfg.intro_file.trim().replace(/^\/+/, ''));
      } else if (typeof cfg.intro === 'string' && /^@file\s*:/i.test(cfg.intro)) {
        const rel = cfg.intro.replace(/^@file\s*:/i, '').trim();
        introPath = path.resolve(dist, rel.replace(/^\/+/, ''));
      }
      if (introPath) {
        if (!fileExists(introPath)) {
          problems.push(`缺少 intro 文件：${introPath}（角色：${name}）`);
        } else {
          const s = await readText(introPath);
          if (!s) problems.push(`intro 文件为空：${introPath}（角色：${name}）`);
        }
      }
    } catch (e) {
      problems.push(`解析 ${p} 失败：${e.message || e}`);
    }
  }

  if (problems.length) {
    console.error('[check-prompts] 校验失败：\n- ' + problems.join('\n- '));
    process.exit(1);
  } else {
    console.log('[check-prompts] 通过：%s', dist);
  }
}

main().catch((e) => {
  console.error('[check-prompts] 运行异常：', e);
  process.exit(1);
});
