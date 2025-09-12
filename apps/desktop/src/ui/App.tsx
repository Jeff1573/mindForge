import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutShell } from './layout/LayoutShell';
import { ChatPanel } from './chat/ChatPanel';
// 占位：Indexer 页面稍后添加到 ui/indexer/IndexerPage
const IndexerPage = React.lazy(() => import('./indexer/IndexerPage').catch(() => ({ default: () => null })));

/**
 * App: 默认渲染聊天界面布局
 * - 左侧 Sidebar，右侧 ChatSurface（消息 + 输入）
 */
export function App() {
  return (
    <HashRouter>
      <LayoutShell>
        <React.Suspense fallback={null}>
          <Routes>
            <Route path="/chat" element={<ChatPanel />} />
            <Route path="/indexer" element={<IndexerPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </React.Suspense>
      </LayoutShell>
    </HashRouter>
  );
}
