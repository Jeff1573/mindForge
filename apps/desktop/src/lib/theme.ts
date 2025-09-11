/**
 * 主题切换（浅色/深色/系统）最小实现
 * - 通过 html[data-theme] 驱动 CSS 变量
 * - 通过 html.classList('dark') 驱动 Tailwind 的 `dark:` 变体
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'mf-theme';

/** 获取系统主题（依赖 prefers-color-scheme） */
export function getSystemTheme(): Exclude<Theme, 'system'> {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 应用主题到 <html> 元素（dataset + class） */
export function applyTheme(effective: Exclude<Theme, 'system'>) {
  const html = document.documentElement;
  html.dataset.theme = effective;
  html.classList.toggle('dark', effective === 'dark');
}

/** 设置主题偏好（持久化），system 表示跟随系统 */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  const effective = theme === 'system' ? getSystemTheme() : theme;
  applyTheme(effective);
}

/** 初始化主题：按本地存储或系统偏好应用，并监听系统切换 */
export function initTheme() {
  const saved = (typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
    : null) || 'system';
  const effective = saved === 'system' ? getSystemTheme() : saved;
  applyTheme(effective);

  // 跟随系统更改（仅当选择 system 时）
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const current = (localStorage.getItem(STORAGE_KEY) as Theme | null) || 'system';
    if (current === 'system') applyTheme(getSystemTheme());
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

