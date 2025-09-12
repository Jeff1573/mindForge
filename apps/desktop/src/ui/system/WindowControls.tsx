import React from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { Button } from 'antd';

// Tauri 窗口控制（v2）：使用 @tauri-apps/api/window
let appWindow: import('@tauri-apps/api/window').Window | null = null;
async function ensureWindow() {
  if (!appWindow) {
    const mod = await import('@tauri-apps/api/window');
    appWindow = mod.getCurrentWindow();
  }
  return appWindow!;
}

export const WindowControls: React.FC = () => {
  const [isMax, setIsMax] = React.useState(false);

  const refreshMax = React.useCallback(async () => {
    try {
      const win = await ensureWindow();
      // @ts-ignore: v2 权限已在 capability 中开启
      const m = await win.isMaximized?.();
      if (typeof m === 'boolean') setIsMax(m);
    } catch (e) {
      // 忽略：在部分平台不可用时不影响按钮功能
    }
  }, []);

  React.useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    (async () => {
      try {
        const win = await ensureWindow();
        // 1) 初始化状态
        await refreshMax();
        // 2) 监听窗口尺寸变化，随系统操作更新图标
        // Tauri v2 提供 onResized；如不存在则回退到通用事件名
        const possible = (win as any).onResized as undefined | ((cb: () => void) => Promise<() => void>);
        if (possible) {
          unlisten = await possible(() => { if (!disposed) refreshMax(); });
        } else if ((win as any).listen) {
          const un = await (win as any).listen('tauri://resize', () => { if (!disposed) refreshMax(); });
          unlisten = () => { try { (un as any)(); } catch { /* noop */ } };
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      disposed = true;
      try { unlisten?.(); } catch { /* noop */ }
    };
  }, [refreshMax]);
  const onMinimize = async () => {
    try {
      const win = await ensureWindow();
      await win.minimize();
    } catch (e) {
      console.warn('minimize failed', e);
    }
  };
  const onToggleMax = async () => {
    try {
      const win = await ensureWindow();
      await win.toggleMaximize();
      // 切换后刷新状态
      setTimeout(refreshMax, 10);
    } catch (e) {
      console.warn('toggleMaximize failed', e);
    }
  };
  const onClose = async () => {
    try {
      const win = await ensureWindow();
      await win.close();
    } catch (e) {
      console.warn('close failed', e);
    }
  };

  return (
    <div className="window-controls pointer-events-auto flex items-center px-1">
      {/* 采用语义类 window-btn，配合 antd Button 的 text 类型，保持可达性 */}
      <Button aria-label="最小化" type="text" className="window-btn" onClick={onMinimize}>
        <Minus style={{ width: 16, height: 16 }} />
      </Button>
      <Button
        aria-label={isMax ? '还原' : '最大化'}
        type="text"
        className="window-btn"
        onClick={onToggleMax}
      >
        {isMax ? <Copy style={{ width: 16, height: 16 }} /> : <Square style={{ width: 16, height: 16 }} />}
      </Button>
      <Button aria-label="关闭" type="text" className="window-btn window-btn--close" onClick={onClose}>
        <X style={{ width: 16, height: 16 }} />
      </Button>
    </div>
  );
};
