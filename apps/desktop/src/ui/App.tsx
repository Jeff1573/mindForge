import React from 'react';
import { LayoutShell } from './layout/LayoutShell';
import { ChatPanel } from './chat/ChatPanel';

/**
 * App: 默认渲染聊天界面布局
 * - 左侧 Sidebar，右侧 ChatSurface（消息 + 输入）
 */
export function App() {
  return (
    <LayoutShell>
      <ChatPanel />
    </LayoutShell>
  );
}
