const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const importPlugin = require('eslint-plugin-import');
const tailwindcss = require('eslint-plugin-tailwindcss');
const prettier = require('eslint-config-prettier');

/**
 * 根级 ESLint 配置（中文注释）
 * - 统一 TypeScript/React 规则；具体应用/包可通过 overrides 补充
 */
module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Node.js
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        console: 'readonly',
        // Browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        // DOM Types
        HTMLButtonElement: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        // ES2022
        Promise: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        WeakMap: 'readonly',
        WeakSet: 'readonly',
        Symbol: 'readonly',
        Proxy: 'readonly',
        Reflect: 'readonly',
        // React
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react,
      'react-hooks': reactHooks,
      import: importPlugin,
      tailwindcss,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...tailwindcss.configs.recommended.rules,
      ...prettier.rules,
      // React 18+ / Vite 无需显式引入 React
      'react/react-in-jsx-scope': 'off',
      // 交由 TS 解析路径，避免 import 插件误报
      'import/no-unresolved': 'off',
    },
    settings: {
      react: { version: 'detect' },
      // 确保 ESLint 插件能解析到 Tailwind 配置（TS 文件亦可）
      tailwindcss: {
        callees: ['cn', 'clsx'],
        config: 'apps/desktop/tailwind.config.ts',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/*.d.ts',
    ],
  },
];