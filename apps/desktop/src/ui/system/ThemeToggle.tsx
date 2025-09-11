import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { type Theme, setTheme } from '../../lib/theme';

/**
 * 主题切换按钮（light/dark/system 三态循环）
 * - 使用 window-btn 语义类，适配标题栏区域。
 * - 左键点击：在 light → dark → system 之间循环。
 */
export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = React.useState<Theme>(() => {
    try {
      return (localStorage.getItem('mf-theme') as Theme) || 'system';
    } catch {
      return 'system';
    }
  });

  const cycle = React.useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(mode);
    const next = order[(idx + 1) % order.length];
    setMode(next);
    setTheme(next);
  }, [mode]);

  const icon = mode === 'light' ? <Sun className="h-4 w-4" /> : mode === 'dark' ? <Moon className="h-4 w-4" /> : <Laptop className="h-4 w-4" />;
  const label = mode === 'light' ? '切换到深色' : mode === 'dark' ? '切换到跟随系统' : '切换到浅色';

  return (
    <Button
      aria-label={`主题：${mode}；${label}`}
      title={`主题：${mode}（点击切换）`}
      size="icon"
      variant="ghost"
      className="window-btn"
      onClick={cycle}
    >
      {icon}
    </Button>
  );
};

