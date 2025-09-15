import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutShell } from './layout/LayoutShell';
import { ChatPanel } from './chat/ChatPanel';
// 占位：Indexer 页面（懒加载）
const IndexerPage = React.lazy(() => import('./indexer/IndexerPage').catch(() => ({ default: () => <></> })));
// 新增：MCP 设置页（懒加载）
const McpToolsPage = React.lazy(() => import('./settings/McpToolsPage').then(m => ({ default: m.McpToolsPage })).catch(() => ({ default: () => <></> })));

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
            <Route path="/settings/mcp" element={<McpToolsPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </React.Suspense>
      </LayoutShell>
    </HashRouter>
  );
}
