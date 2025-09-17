// 目的：开发模式下将 `electron/prompts` 的变更同步到 `dist/prompts`
// 使用：node apps/desktop/scripts/watch-prompts.cjs
// 设计：
// - 启动时执行一次全量复制；
// - 监听源目录变动（fs.watch，Windows/macOS 支持 recursive）；
// - 如不支持递归监听，退化为固定间隔轮询；
// - 变更去抖，避免频繁复制；

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

function dirExists(p) { try { return fs.existsSync(p); } catch { return false; } }

async function main() {
  const root = path.resolve(__dirname, '..');
  const src = path.resolve(root, 'electron/prompts');
  const dest = path.resolve(root, 'dist/prompts');

  if (!dirExists(src)) {
    console.warn('[watch-prompts] 源目录不存在：%s', src);
    return;
  }

  let copying = false;
  let dirty = false;

  const doCopy = async (reason) => {
    if (copying) { dirty = true; return; }
    copying = true;
    try {
      await copyDir(src, dest);
      console.log('[watch-prompts] 已同步 → %s  （原因：%s）', dest, reason || '变更');
    } catch (e) {
      console.error('[watch-prompts] 同步失败：', e.message || e);
    } finally {
      copying = false;
      if (dirty) { dirty = false; doCopy('累积变更'); }
    }
  };

  // 初次全量复制
  await doCopy('启动');

  // 去抖调度器
  let debounceTimer = null;
  const markDirty = (why) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doCopy(why), 200);
  };

  // 尝试递归监听（Windows/macOS 支持）
  let watcher = null;
  try {
    watcher = fs.watch(src, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      markDirty(`${eventType}:${filename}`);
    });
    console.log('[watch-prompts] 已启用递归监听：%s', src);
  } catch (e) {
    console.warn('[watch-prompts] 递归监听不可用，启用轮询：%s', e.message || e);
    // 退化为轮询（低频复制，尽量避免打扰）
    const POLL_MS = 1000;
    setInterval(() => markDirty('轮询'), POLL_MS);
  }

  const graceful = async () => {
    try { if (watcher) watcher.close(); } catch {}
    // 留一点时间让最后的复制完成
    await sleep(50);
    process.exit(0);
  };

  process.on('SIGINT', graceful);
  process.on('SIGTERM', graceful);
}

main().catch((e) => {
  console.error('[watch-prompts] 运行失败：', e);
  process.exit(1);
});

