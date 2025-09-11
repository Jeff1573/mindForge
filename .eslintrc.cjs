/**
 * 根级 ESLint 配置（中文注释）
 * - 统一 TypeScript/React 规则；具体应用/包可通过 overrides 补充
 */
module.exports = {
  root: true,
  env: { es2022: true, node: true, browser: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "react", "react-hooks", "import", "tailwindcss"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "plugin:tailwindcss/recommended",
    "prettier"
  ],
  settings: {
    react: { version: "detect" },
    // 确保 ESLint 插件能解析到 Tailwind 配置（TS 文件亦可）
    tailwindcss: {
      callees: ["cn", "clsx"],
      config: "apps/desktop/tailwind.config.ts"
    }
  },
  ignorePatterns: [
    "dist",
    "build",
    "node_modules",
    ".turbo",
    "**/*.d.ts"
  ],
  rules: {
    // React 18+ / Vite 无需显式引入 React
    "react/react-in-jsx-scope": "off",
    // 交由 TS 解析路径，避免 import 插件误报
    "import/no-unresolved": "off"
  }
};
