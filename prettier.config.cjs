/**
 * 根级 Prettier 配置（中文注释）
 */
module.exports = {
  semi: true,
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  // Tailwind 类名排序（与团队风格统一）
  plugins: [require('prettier-plugin-tailwindcss')]
};
