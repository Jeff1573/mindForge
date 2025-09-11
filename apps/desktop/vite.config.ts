import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 中文注释：Vite 基础配置；Tauri 开发时由 CLI 代理启动
export default defineConfig({
  plugins: [react()],
  // Tauri v2 建议配置：避免预打包 @tauri-apps 模块，减少解析问题
  optimizeDeps: {
    exclude: ['@tauri-apps/api', '@tauri-apps/plugin-os'],
  },
  build: {
    target: 'es2021',
  },
});
