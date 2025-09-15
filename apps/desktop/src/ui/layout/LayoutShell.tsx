import React from 'react';
import { Sidebar } from './Sidebar';
import { WindowControls } from '../system/WindowControls';
import { ThemeToggle } from '../system/ThemeToggle';
import { Button } from 'antd';
import { Menu } from 'lucide-react';

/**
 * LayoutShell: 左侧窄侧边栏 + 右侧内容区
 * - 背景：浅色渐变（见 index.css 中 .bg-page）
 * - 高度：铺满窗口
 */
export const LayoutShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onToggle: (ev: Event) => void = () => setMobileOpen((v) => !v);
    const onOpen: (ev: Event) => void = () => setMobileOpen(true);
    const onClose: (ev: Event) => void = () => setMobileOpen(false);
    window.addEventListener('mf:toggleSidebar', onToggle);
    window.addEventListener('mf:openSidebar', onOpen);
    window.addEventListener('mf:closeSidebar', onClose);
    return () => {
      window.removeEventListener('mf:toggleSidebar', onToggle);
      window.removeEventListener('mf:openSidebar', onOpen);
      window.removeEventListener('mf:closeSidebar', onClose);
    };
  }, []);

  return (
    <div className="bg-page mf-page safe-area">
      <div className="mf-root-row">
        {/* 桌面端固定侧边栏；移动端隐藏 */}
        <div className="mf-sidebar-desktop">
          <Sidebar />
        </div>
        <main className="mf-content cq cq-name">
          {/* 固定标题栏：不随路由切换消失 */}
          <div className="mf-titlebar titlebar titlebar-surface">
            <div className="titlebar-no-drag mf-show-mobile" style={{ paddingRight: '0.25rem' }}>
              <Button
                aria-label="打开菜单"
                type="text"
                className="window-btn"
                onClick={() => window.dispatchEvent(new Event('mf:toggleSidebar'))}
              >
                <Menu style={{ width: 16, height: 16 }} />
              </Button>
            </div>
            <div className="mf-titlebar-spacer" />
            <div className="mf-titlebar-actions">
              <ThemeToggle />
              <WindowControls />
            </div>
          </div>
          {children}
        </main>
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
