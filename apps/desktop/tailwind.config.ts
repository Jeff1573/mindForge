import type { Config } from 'tailwindcss';

// 中文注释：将 CSS 变量（HSL 数值）映射为 Tailwind 语义色
const colorVar = (name: string) => `hsl(var(${name}))`;

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: colorVar('--color-bg'),
        foreground: colorVar('--color-fg'),

        muted: {
          DEFAULT: colorVar('--color-muted'),
          foreground: colorVar('--color-muted-foreground'),
        },
        primary: {
          DEFAULT: colorVar('--color-primary'),
          foreground: colorVar('--color-primary-foreground'),
        },
        secondary: {
          DEFAULT: colorVar('--color-secondary'),
          foreground: colorVar('--color-secondary-foreground'),
        },
        accent: {
          DEFAULT: colorVar('--color-accent'),
          foreground: colorVar('--color-accent-foreground'),
        },
        destructive: {
          DEFAULT: colorVar('--color-destructive'),
          foreground: colorVar('--color-destructive-foreground'),
        },
        border: colorVar('--color-border'),
        input: colorVar('--color-input'),
        ring: colorVar('--color-ring'),
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
    },
  },
  plugins: [],
} satisfies Config;
