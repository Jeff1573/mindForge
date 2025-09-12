import React from 'react';
import { Sidebar } from './Sidebar';

/**
 * LayoutShell: 左侧窄侧边栏 + 右侧内容区
 * - 背景：浅色渐变（见 index.css 中 .bg-page）
 * - 高度：铺满窗口
 */
export const LayoutShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onToggle = () => setMobileOpen((v) => !v);
    const onOpen = () => setMobileOpen(true);
    const onClose = () => setMobileOpen(false);
    window.addEventListener('mf:toggleSidebar', onToggle as any);
    window.addEventListener('mf:openSidebar', onOpen as any);
    window.addEventListener('mf:closeSidebar', onClose as any);
    return () => {
      window.removeEventListener('mf:toggleSidebar', onToggle as any);
      window.removeEventListener('mf:openSidebar', onOpen as any);
      window.removeEventListener('mf:closeSidebar', onClose as any);
    };
  }, []);

  return (
    <div className="bg-page mf-page safe-area">
      <div className="mf-root-row">
        {/* 桌面端固定侧边栏；移动端隐藏 */}
        <div className="mf-sidebar-desktop">
          <Sidebar />
        </div>
        <main className="mf-content cq cq-name">{children}</main>
      </div>

      {/* 移动端抽屉式侧边栏 */}
      {mobileOpen && (
        <div className="mf-mobile-overlay">
          <div className="mf-dim" onClick={() => setMobileOpen(false)} />
          <div className="mf-drawer">
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
};
