import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initTheme } from './lib/theme';
import './index.css';
import { primePlatformDatasetSync, applyPlatformDataset } from './lib/platform';

// 预置平台标识（UA 回退，尽可能早）
primePlatformDatasetSync();
// 初始化主题（浅色/深色/系统）
initTheme();
// 异步获取 Tauri 平台并覆写 data-platform（若可用）
void applyPlatformDataset();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
