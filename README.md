# MindForge Monorepo

> 桌面端（Tauri v2 + Vite + React + Tailwind + shadcn/ui）与后端（Fastify），含 packages：shared / ui / mcp-server。

## 先决条件
- Node.js ≥ 20（建议启用 Corepack）
- pnpm（建议：`corepack enable && corepack prepare pnpm@10 --activate`）
- Rust 工具链（Windows 需 MSVC）

可执行脚本检测/安装 Rust：
```
pwsh scripts/check-rust.ps1 -InstallIfMissing
```

## 环境变量
复制根目录 `.env.example` 为 `.env` 并按需填写：
- AI_PROVIDER（gemini/openai）、AI_MODEL、AI_API_KEY
- QDRANT_URL、QDRANT_API_KEY、QDRANT_COLLECTION（默认 docs）
- MCP_SERVER_URL、MCP_API_KEY

## 安装依赖
```
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
```

## 开发调试
- 并行启动 API 与 Desktop：
```
pnpm dev
```
- 仅启动 API：
```
pnpm --filter @mindforge/api dev
```
- 仅启动 Desktop（Tauri 会同时运行 Vite）：
```
pnpm --filter @mindforge/desktop dev
```

API 默认端口：`http://localhost:4000`，健康检查：`/health`，环境：`/env`。

## 构建
- 构建所有：`pnpm build`
- 构建 Desktop 安装包：`pnpm --filter @mindforge/desktop build`

## Windows 打包图标配置（Tauri）
- 桌面端包路径：`apps/desktop`
- 为避免 Windows MSI 打包时报错 `Couldn't find a .ico icon`，在 `apps/desktop/src-tauri/tauri.conf.json` 显式配置：
  - `bundle.icon`: `[
    "icons/icon.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ]`
- 图标资源目录：`apps/desktop/src-tauri/icons/`（仓库已提供完整集）
- 如需更换/重新生成图标：基于 `apps/desktop/assets/icon.svg` 运行
  - `pnpm -C apps/desktop run icon:regen`
  该命令会生成 `.ico/.icns/.png` 的全套图标资源。

## 样式体系约定（Tailwind + shadcn/ui）

- 设计令牌：使用 CSS 变量（HSL 数值）统一配色、圆角与边框：
  - 浅色在 `:root`，深色在 `html[data-theme="dark"]` 中定义。
  - 示例变量：`--color-bg/fg/primary/secondary/muted/border/ring`、`--radius-sm/md/lg`。
- Tailwind 映射：在 `apps/desktop/tailwind.config.ts` 的 `theme.extend.colors` 中以 `hsl(var(--color-xxx))` 暴露为 `background/foreground/primary/...` 等语义色；`borderRadius` 绑定到 `--radius-*`。
- 主题切换：调用 `setTheme('light'|'dark'|'system')`；应用启动时 `initTheme()` 已启用，依赖 `html[data-theme]` 与 `dark` class。
- 语义组件层（`@layer components`）：优先使用语义类减少原子类拼接：
  - 容器类：`.panel`（一般面板）、`.card`（卡片）、`.toolbar`（工具条）。
  - 表单/按钮：`.input-base`、`.btn-ghost`。
  - 标题栏/窗口：`.titlebar`、`.titlebar-surface`、`.window-btn`、`.window-btn--close`。
- 组件变体：统一采用 `cva + cn`（见 `components/ui/button.tsx`）。
- 工具链：已启用 `prettier-plugin-tailwindcss` 与 `eslint-plugin-tailwindcss`；类名排序与合法性由工具保障。

### 样式与平台适配指南（2025-09-11）

- 平台标识：应用启动时设置 `document.documentElement.dataset.platform = 'windows'|'mac'|'linux'|'mobile'|'web'`，供 CSS 平台覆写使用。
- 令牌：`apps/desktop/src/index.css` 的 `:root` 定义了颜色、圆角、`--titlebar-height`、`--control-height`、密度与字体等变量；各平台在 `html[data-platform=...]` 中覆写。
- 布局：含自绘标题栏的页面将根容器加上 `with-titlebar`；移动端容器叠加 `safe-area` 以适配刘海/圆角屏。
- 模糊与降级：`--fx-blur` 控制强度；在 `@supports (backdrop-filter)` 条件内启用，否则自动降级到无模糊。
- 容器查询：为组件根容器添加 `cq cq-name`，可用 `@container layout (min-width: ...)` 调整排版；Tailwind 断点仍作为回退。
- 滚动条：已提供 Firefox/Chromium/WebKit 的近似样式与 `scrollbar-gutter: stable`，减少布局抖动。

### 跨平台验收清单（手动）

- 主题与对比度：浅/深色下文字与控件对比度满足可读（暗背景上主色按钮可辨）。
- 平台标识：`data-platform` 在 Windows/macOS/Linux/移动端分别为期望值；Titlebar 高度随之变化。
- 标题栏交互：拖拽区域有效；按钮区域 `no-drag` 保证可点击；macOS 左侧布局正确。
- 模糊降级：在 Linux 或禁用 `backdrop-filter` 的环境无异常；启用时模糊强度符合平台预期。
- 滚动条：样式接近设计；出现/隐藏滚动条时布局不抖动。
- 容器查询：在支持容器查询的环境，聊天气泡宽度随容器变化；不支持时以断点回退。
- 安全区：移动端顶部/底部/左右安全区内无内容被遮挡。

## 工作区结构
- apps/desktop：Tauri v2 + Vite + React + Tailwind + shadcn
- apps/api：Fastify + TypeScript
- packages/shared：环境变量与通用工具
- packages/ui：UI 组件库（shadcn 风格）
- packages/mcp-server：MCP 服务骨架

## 版本基线（2025-09-10）
见 `.workflow/workflow_初始化与基础设施_2025-09-10.md`。

## Git 忽略策略（集中管理）
- 根级 `.gitignore` 统一覆盖子包（Turborepo）。
- 关键范围：`**/node_modules/`, `**/dist/`, `**/.turbo/`, `**/.vite/`, `**/.cache/`, `**/*.tsbuildinfo`。
- Tauri/Rust：仅忽略 `**/src-tauri/target/**` 与打包产物；保留 `Cargo.lock`。
- 环境变量：忽略 `.env` 与 `.env.*`，保留 `.env.example`。
- IDE/OS：忽略 `.vscode/`、`.idea/`、`.DS_Store`、`Thumbs.db` 等。

若历史已跟踪了被忽略的产物，可执行一次清理（仅从索引移除，不删工作区）：
```
git ls-files -z | git check-ignore -z --stdin | tr '\0' '\n' | git rm -r --cached -f --pathspec-from-file - --pathspec-file-nul
```
