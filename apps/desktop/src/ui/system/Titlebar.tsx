import React from 'react';
import { WindowControls } from './WindowControls';

/**
 * Titlebar: 自定义标题栏（全平台统一），提供左侧可拖拽区域与右侧窗口控制按钮。
 * - 拖拽区域: 使用 CSS `-webkit-app-region: drag`（见 index.css 中的 `.titlebar-drag`）。
 * - 控制按钮: 使用 `.titlebar-no-drag` 避免拖拽吞掉点击。
 */
export const Titlebar: React.FC = () => {
  return (
    <div
      className={
        'titlebar-drag h-9 flex items-center justify-between select-none '+
        'border-b border-black/10 dark:border-white/10 '+
        'bg-white/70 dark:bg-neutral-900/70 backdrop-blur'
      }
    >
      {/* 左侧：可拖拽区域，可放置应用名或占位 */}
      <div className="flex-1 px-3 text-xs text-neutral-600 dark:text-neutral-300 truncate">
        MindForge
      </div>

      {/* 右侧：窗口控制按钮（禁止拖拽） */}
      <div className="titlebar-no-drag h-full flex items-center">
        <WindowControls />
      </div>
    </div>
  );
};

