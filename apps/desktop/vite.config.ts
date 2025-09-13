import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 中文注释：纯渲染进程（Vite）配置，Electron 主进程由 TypeScript 编译器(tsc)独立编译
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2021',
  },
});
