import React from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { Button } from 'antd';

// 中文注释：通过 Electron 预加载脚本暴露的 window.api 进行窗口控制
type WindowApi = {
  minimize: () => Promise<void> | void;
  toggleMaximize: () => Promise<void> | void;
  isMaximized: () => Promise<boolean> | boolean;
  close: () => Promise<void> | void;
  onResized?: (cb: () => void) => () => void;
};

declare global {
  interface Window { api?: WindowApi }
}

export const WindowControls: React.FC = () => {
  const [isMax, setIsMax] = React.useState(false);

  const refreshMax = React.useCallback(async () => {
    try {
      const m = await window.api?.isMaximized?.();
      if (typeof m === 'boolean') setIsMax(m);
    } catch {
      // noop
    }
  }, []);

  React.useEffect(() => {
    setTimeout(() => { void refreshMax(); }, 0);
    const off = window.api?.onResized?.(() => { void refreshMax(); });
    return () => { try { off?.(); } catch { /* noop */ } };
  }, [refreshMax]);

  const onMinimize = () => { try { window.api?.minimize(); } catch { /* noop */ } };
  const onToggleMax = () => { try { window.api?.toggleMaximize(); setTimeout(() => void refreshMax(), 10); } catch { /* noop */ } };
  const onClose = () => { try { window.api?.close(); } catch { /* noop */ } };

  return (
    <div className="window-controls pointer-events-auto flex items-center px-1">
      <Button aria-label="最小化" type="text" className="window-btn" onClick={onMinimize}>
        <Minus style={{ width: 16, height: 16 }} />
      </Button>
      <Button aria-label={isMax ? '还原' : '最大化'} type="text" className="window-btn" onClick={onToggleMax}>
        {isMax ? <Copy style={{ width: 16, height: 16 }} /> : <Square style={{ width: 16, height: 16 }} />}
      </Button>
      <Button aria-label="关闭" type="text" className="window-btn window-btn--close" onClick={onClose}>
        <X style={{ width: 16, height: 16 }} />
      </Button>
    </div>
  );
};
