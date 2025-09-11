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
    <div className="bg-page h-full w-full relative safe-area">
      <div className="flex h-full w-full overflow-hidden">
        {/* 桌面端固定侧边栏；移动端隐藏 */}
        <div className="hidden md:block">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0 cq cq-name">{children}</main>
      </div>

      {/* 移动端抽屉式侧边栏 */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
};
