import React from 'react';
import { Sidebar } from './Sidebar';

/**
 * LayoutShell: 左侧窄侧边栏 + 右侧内容区
 * - 背景：浅色渐变（见 index.css 中 .bg-page）
 * - 高度：铺满窗口
 */
export const LayoutShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="bg-page h-full w-full relative">
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
};
