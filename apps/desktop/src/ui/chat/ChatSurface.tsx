import React from 'react';

/**
 * ChatSurface: 右侧对话容器（玻璃拟物卡片）
 * - Header: 标题区占位
 * - Body: 之后挂载 MessageList
 * - Footer: 之后挂载 ChatInput
 */
export const ChatSurface: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="surface-glass shadow-glass relative flex h-full flex-col gap-2">
      {children}
    </div>
  );
};
