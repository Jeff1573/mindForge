import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

// 中文注释：Vite + Electron 一体化构建（主进程/预加载/渲染器）
export default defineConfig({
  plugins: [
    react(),
    electron({
      // 主进程入口：使用 TypeScript
      main: {
        entry: 'electron/main.ts',
        onstart(options) {
          // 开发模式自动启动 Electron
          options.startup();
        },
      },
      // 预加载脚本：通过 contextBridge 暴露受控 API
      preload: {
        input: {
          preload: 'electron/preload.ts',
        },
      },
    }),
  ],
  build: {
    target: 'es2021',
  },
});
