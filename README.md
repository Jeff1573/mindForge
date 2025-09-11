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
