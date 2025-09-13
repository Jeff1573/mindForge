// @ts-nocheck

const { createServer } = require('vite');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const electronPath = require('electron');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForFiles(filePaths, timeoutMs = 10000, intervalMs = 100) {
  const start = Date.now();
  for (;;) {
    const allExist = filePaths.every((p) => fs.existsSync(p));
    if (allExist) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`等待编译产物超时: ${filePaths.join(', ')}`);
    }
    await sleep(intervalMs);
  }
}

(async () => {
  // 1) 启动 Vite Dev Server（读取本目录 vite.config.ts）
  const server = await createServer();
  await server.listen();
  try { server.printUrls(); } catch {
    // ignore
  }

  // 2) 解析可用 URL（优先本地，其次网络，最后端口兜底）
  const urls = server.resolvedUrls || {};
  let url =
    (urls.local && urls.local[0]) ||
    (urls.network && urls.network[0]) ||
    '';
  if (!url) {
    let port = server.config?.server?.port;
    try {
      const addr = server.httpServer && server.httpServer.address && server.httpServer.address();
      if (addr && typeof addr === 'object' && addr.port) port = addr.port;
    } catch {
      // ignore
    }
    url = `http://localhost:${port || 5173}`;
  }
  console.log('[dev] Vite URL:', url);

  // 3) 等待 tsc 产物就绪后再启动 Electron
  const distDir = path.join(__dirname, '..', 'dist');
  const preloadJs = path.join(distDir, 'preload.js');
  const mainJs = path.join(distDir, 'main.js');
  await waitForFiles([preloadJs, mainJs]).catch(async (err) => {
    console.error('[dev] 等待 tsc 编译产物失败:', err.message);
    try { await server.close(); } catch {
      // ignore
    }
    process.exit(1);
  });

  // 4) 注入 URL 启动 Electron 主进程
  const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: url },
    cwd: path.join(__dirname, '..'),
  });

  const gracefulExit = async (code) => {
    try { await server.close(); } catch {}
    try { if (!child.killed) child.kill(); } catch {}
    process.exit(code ?? 0);
  };

  process.on('SIGINT', () => gracefulExit(130));
  process.on('SIGTERM', () => gracefulExit(143));
  child.on('close', (code) => gracefulExit(code));
})().catch(async (err) => {
  console.error('[dev] 启动失败:', err);
  process.exit(1);
});
