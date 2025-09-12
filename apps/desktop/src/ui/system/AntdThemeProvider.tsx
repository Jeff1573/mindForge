import React from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

/**
 * AntdThemeProvider
 * - 启用 antd v5 的 CSS 变量（cssVar: true），并基于当前 html[data-theme] 选择 light/dark 算法。
 * - 从现有的 CSS 设计令牌（HSL 数值）中读取关键色，映射到 antd token，保持与现有主题一致。
 * - 通过 MutationObserver 监听 <html> 的 data-theme/class 变化（由 setTheme/system 切换触发），实时更新。
 */
export const AntdThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isDark, setIsDark] = React.useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // 从 CSS 变量（HSL 数值）读取并转为可用的颜色字符串（hsl(...)）
  const readHsl = React.useCallback((name: string) => {
    if (typeof window === 'undefined') return undefined as string | undefined;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? `hsl(${v})` : undefined;
  }, []);

  const readHslAlpha = React.useCallback((name: string, alpha: number) => {
    if (typeof window === 'undefined') return undefined as string | undefined;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v ? `hsl(${v} / ${alpha})` : undefined;
  }, []);

  // 读取尺寸变量（rem/px），返回像素数值，用于 antd 的边角 token
  const readSizePx = React.useCallback((name: string) => {
    if (typeof window === 'undefined') return undefined as number | undefined;
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw) return undefined;
    if (raw.endsWith('rem')) {
      const n = parseFloat(raw);
      const fs = parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
      return Math.round(n * fs);
    }
    if (raw.endsWith('px')) return Math.round(parseFloat(raw));
    const n = parseFloat(raw);
    return Number.isFinite(n) ? Math.round(n) : undefined;
  }, []);

  // 监听 html 层主题切换（由 initTheme/setTheme 驱动）
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const html = document.documentElement;
    const update = () => setIsDark(html.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(html, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => obs.disconnect();
  }, []);

  const tokens = React.useMemo(() => {
    return {
      // 核心品牌主色
      colorPrimary: readHsl('--color-primary'),
      // 基础背景/文本/边框，尽量对齐现有主题
      colorBgBase: readHsl('--color-bg'),
      colorBgContainer: readHsl('--color-bg'),
      colorTextBase: readHsl('--color-fg'),
      colorBorder: readHsl('--color-border'),
      colorText: readHsl('--color-fg'),
      colorTextPlaceholder: readHsl('--color-muted-foreground'),
      colorTextDisabled: readHslAlpha('--color-fg', 0.35),
      colorBgContainerDisabled: readHslAlpha('--color-muted', 0.6),
      // 圆角取中值，尽量靠近现有控件观感
      borderRadius: readSizePx('--radius-md'),
      controlHeight: readSizePx('--control-height'),
    } as any;
  }, [readHsl, readSizePx]);

  return (
    <ConfigProvider
      theme={{
        cssVar: true,
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: tokens,
        components: {
          Button: {
            // 提升浅色主题下的可见性：文本按钮 hover/active 背景采用 muted 语义色
            colorBgTextHover: readHslAlpha('--color-muted', 0.7),
            colorBgTextActive: readHslAlpha('--color-muted', 0.8),
            colorText: readHsl('--color-fg'),
          },
          Input: {
            colorBgContainer: readHsl('--color-bg'),
            colorText: readHsl('--color-fg'),
            colorBorder: readHsl('--color-border'),
            colorTextPlaceholder: readHsl('--color-muted-foreground'),
            activeBorderColor: readHsl('--color-primary'),
            hoverBorderColor: readHsl('--color-primary'),
            borderRadius: readSizePx('--radius-md'),
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};
