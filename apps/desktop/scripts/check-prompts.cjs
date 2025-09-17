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

  const defaultRole = path.join(rolesDir, 'default.json');
  if (!fileExists(defaultRole)) {
    problems.push(`缺少默认角色：${defaultRole}`);
  } else {
    try {
      const cfg = JSON.parse(await fsp.readFile(defaultRole, 'utf8'));
      const frags = Array.isArray(cfg.fragments) ? cfg.fragments : [];
      for (const id of frags) {
        const fp = path.join(commonDir, `${String(id).replace(/\.md$/i, '')}.md`);
        if (!fileExists(fp)) problems.push(`缺少公共片段：${fp}`);
      }
    } catch (e) {
      problems.push(`解析 ${defaultRole} 失败：${e.message || e}`);
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

