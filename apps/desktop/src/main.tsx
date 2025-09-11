import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { initTheme } from './lib/theme';
import './index.css';

// 初始化主题（浅色/深色/系统）
initTheme();

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
