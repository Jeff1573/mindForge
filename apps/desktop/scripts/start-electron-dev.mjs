import { createServer } from 'net';
import { existsSync } from 'fs';
import { setTimeout as delay } from 'timers/promises';
import { spawn } from 'child_process';
import path from 'node:path';

const VITE_PORT = 5173;
const DIST_MAIN = path.resolve(process.cwd(), 'dist-electron', 'main.mjs');

async function waitForPort(port, host = '127.0.0.1', timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isOpen = await new Promise((resolve) => {
      const socket = createServer();
      socket.once('error', () => resolve(false));
      socket.once('listening', () => {
        socket.close(() => resolve(false));
      });
      socket.listen(port, host, () => {
        socket.close(() => resolve(false));
      });
    });
    const inUse = !isOpen;
    if (inUse) return true;
    await delay(500);
  }
  return false;
}

async function waitForFile(filePath, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (existsSync(filePath)) return true;
    await delay(500);
  }
  return false;
}

async function main() {
  const portReady = await waitForPort(VITE_PORT);
  if (!portReady) {
    console.error(`等待端口失败：${VITE_PORT}`);
    process.exit(1);
  }

  const fileReady = await waitForFile(DIST_MAIN);
  if (!fileReady) {
    console.error(`等待主进程构建产物失败：${DIST_MAIN}`);
    process.exit(1);
  }

  const env = { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${VITE_PORT}` };
  const electronPath = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  const child = spawn(electronPath, [DIST_MAIN], {
    stdio: 'inherit',
    env,
    shell: true,
  });

  await new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      console.log(`Electron 进程退出，code=${code} signal=${signal ?? ''}`);
      resolve();
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
