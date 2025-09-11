import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 中文注释：Vite 基础配置；Tauri 开发时由 CLI 代理启动
export default defineConfig({
  plugins: [react()],
});
