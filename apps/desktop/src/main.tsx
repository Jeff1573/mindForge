import React from 'react';
// 全局引入 antd v5 的样式基线重置（不包含组件样式，仅 Reset）
import 'antd/dist/reset.css';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { AntdThemeProvider } from './ui/system/AntdThemeProvider';
import { initTheme } from './lib/theme';
import './index.css';
import { primePlatformDatasetSync, applyPlatformDataset } from './lib/platform';

// 预置平台标识（UA 回退，尽可能早）
primePlatformDatasetSync();
// 初始化主题（浅色/深色/系统）
initTheme();
// 异步获取 Electron 预加载提供的平台并覆写 data-platform（若可用）
void applyPlatformDataset();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {/* antd 主题提供（启用 cssVar），内部监听 html[data-theme] 与 dark class */}
    <AntdThemeProvider>
      <App />
    </AntdThemeProvider>
  </React.StrictMode>
);
