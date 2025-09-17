// 目的：在 Electron 主进程构建后，将 prompts 资产（json/md）复制到 dist/prompts
// 运行：node apps/desktop/scripts/copy-prompts.cjs
// 已在 package.json 的 build:electron 中串联执行

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fsp.copyFile(s, d);
    }
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const src = path.resolve(root, 'electron/prompts');
  const dest = path.resolve(root, 'dist/prompts');

  if (!fs.existsSync(src)) {
    console.warn('[copy-prompts] 源目录不存在：%s', src);
    return;
  }
  await copyDir(src, dest);
  console.log('[copy-prompts] 已复制 prompts 到：%s', dest);
}

main().catch((e) => {
  console.error('[copy-prompts] 失败：', e);
  process.exitCode = 1;
});

