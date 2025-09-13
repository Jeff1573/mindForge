# MindForge Monorepo

> 桌面端（Electron + Vite + React + Tailwind + shadcn/ui）与后端（Fastify），含 packages：shared / ui / mcp-server。

## 先决条件
- Node.js ≥ 20（建议启用 Corepack）
- npm（Node.js 内置）
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
npm install
```

## 在不同 workspace 安装依赖（npm）

> 所有命令均在仓库根目录执行。使用 `-w|--workspace <name>` 指定目标工作区。

常用场景：

```bash
# 安装到 Desktop（生产依赖）
npm i <pkg> -w @mindforge/desktop

# 安装到 Desktop（开发依赖/仅构建或类型用）
npm i -D <pkg> -w @mindforge/desktop

# 安装到 API（生产依赖）
npm i <pkg> -w @mindforge/api

# 同时安装到多个 workspace（可重复 -w）
npm i <pkg> -w @mindforge/desktop -w @mindforge/api

# 安装类型声明（如果库未内置类型）
npm i -D @types/<pkg> -w @mindforge/desktop

# 卸载依赖
npm un <pkg> -w @mindforge/desktop

# 添加 peer / optional 依赖（组件库常用）
npm i <pkg> --save-peer -w @mindforge/ui
npm i <pkg> --save-optional -w @mindforge/desktop

# 引用本地包（workspace 协议）
npm i @mindforge/ui@workspace:* -w @mindforge/desktop
npm i @mindforge/mcp-server@workspace:* -w @mindforge/api
```

Electron 原生模块（仅 Desktop）

```bash
# 安装原生模块后，为当前 Electron 版本重建
npm i <native-pkg> -w @mindforge/desktop
npm exec -w @mindforge/desktop electron-rebuild
```

注意事项：
- 锁文件位于根目录，由 npm 统一管理；不需要在子包单独运行 `npm install`。
- Desktop 主进程当前使用 CommonJS；若依赖为 ESM-only，可采用 `await import('<pkg>')` 动态导入。

## 开发调试
- 并行启动 API 与 Desktop：
```
npm run dev
```
- 仅启动 API：
```
npm run dev --workspace=@mindforge/api
```
- 仅启动 Desktop（Electron + Vite 一体开发）：
```
npm run dev --workspace=@mindforge/desktop
```

API 默认端口：`http://localhost:4000`，健康检查：`/health`，环境：`/env`。

## 构建
- 构建所有：`npm run build`
- 构建 Desktop 前端与主进程（后续将补充安装包构建）：`npm run build --workspace=@mindforge/desktop`

## Windows 打包图标配置（Electron 规划）
- 图标源：`apps/desktop/assets/icon.svg`。
- 后续使用 `electron-builder`，图标放置在 `apps/desktop/build/icons/`。

## 样式体系约定（antd + 原生 CSS）

- 设计令牌：仍使用 CSS 变量（HSL 数值）统一配色、圆角与边框：
  - 浅色在 `:root`，深色在 `html[data-theme="dark"]` 中定义。
  - 示例变量：`--color-bg/fg/primary/secondary/muted/border/ring`、`--radius-sm/md/lg`。
- antd 主题：在 `AntdThemeProvider` 中启用 `cssVar: true`，并根据 `html[data-theme]` 切换 `light/dark` 算法；从现有 CSS 变量读取 `colorPrimary/colorBgBase/...` 注入 antd token，保持观感一致。
- 语义组件层（纯 CSS）：优先使用语义类减少样式分散：
  - 容器类：`.panel`（一般面板）、`.card`（卡片）、`.toolbar`（工具条）、`.surface-glass`（玻璃容器）。
  - 标题栏/窗口：`.titlebar`、`.titlebar-surface`、`.window-btn`、`.window-btn--close`。
  - 聊天：`.bubble-in/.bubble-out`（气泡）、`.bubble-tail-*`（尖角）、`.mf-*`（布局与响应语义类）。
- 平台与增强：
  - 平台标识：`data-platform` 变量（`--fx-blur/--panel-opacity/...`）保留。
  - 容器查询：启用 `.cq .cq-name` 与 `@container` 调整布局。
  - 滚动条：提供 Firefox/Chromium/WebKit 的近似样式与 `scrollbar-gutter: stable`。

### 跨平台验收清单（手动）

- 主题与对比度：浅/深色下文字与控件对比度满足可读（暗背景上主色按钮可辨）。
- 平台标识：`data-platform` 在 Windows/macOS/Linux/移动端分别为期望值；Titlebar 高度随之变化。
- 标题栏交互：拖拽区域有效；按钮区域 `no-drag` 保证可点击；macOS 左侧布局正确。
- 模糊降级：在 Linux 或禁用 `backdrop-filter` 的环境无异常；启用时模糊强度符合平台预期。
- 滚动条：样式接近设计；出现/隐藏滚动条时布局不抖动。
- 容器查询：在支持容器查询的环境，聊天气泡宽度随容器变化；不支持时以断点回退。
- 安全区：移动端顶部/底部/左右安全区内无内容被遮挡。

## 工作区结构
- apps/desktop：Electron + Vite + React + Tailwind + shadcn
- apps/api：Fastify + TypeScript
- packages/shared：环境变量与通用工具
- packages/ui：UI 组件库（shadcn 风格）
- packages/mcp-server：MCP 服务骨架

## 版本基线（2025-09-10）
见 `.workflow/workflow_初始化与基础设施_2025-09-10.md`。

## Git 忽略策略（集中管理）
- 根级 `.gitignore` 统一覆盖子包（Turborepo）。
- 关键范围：`**/node_modules/`, `**/dist/`, `**/.turbo/`, `**/.vite/`, `**/.cache/`, `**/*.tsbuildinfo`。
- Rust：仅忽略 `**/target/**` 与打包产物；保留 `Cargo.lock`。
- 环境变量：忽略 `.env` 与 `.env.*`，保留 `.env.example`。
- IDE/OS：忽略 `.vscode/`、`.idea/`、`.DS_Store`、`Thumbs.db` 等。

若历史已跟踪了被忽略的产物，可执行一次清理（仅从索引移除，不删工作区）：
```
git ls-files -z | git check-ignore -z --stdin | tr '\0' '\n' | git rm -r --cached -f --pathspec-from-file - --pathspec-file-nul
```
