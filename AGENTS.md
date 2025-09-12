# Repository Guidelines

## 项目结构与模块组织
- Monorepo（pnpm + Turborepo）。应用：`apps/desktop`（Tauri v2 + Vite + React）、`apps/api`（Fastify）。
- 包：`packages/shared`（环境与工具）、`packages/ui`（UI 组件）、`packages/mcp-server`（MCP 骨架）。
- Rust：`crates/indexer`（仓库扫描 CLI）。资产位于 `apps/desktop/assets/`；如新增测试，建议放各包的 `tests/`。

## 构建、测试与开发命令
- 安装依赖：`pnpm install`
- 并行开发：`pnpm dev`（同时启动 API 与 Desktop）
- 全量构建：`pnpm build`；质量校验：`pnpm lint`、`pnpm format`
- 按包运行：
  - API：`pnpm --filter @mindforge/api dev`（smoke：`pnpm --filter @mindforge/api smoke`）
  - Desktop：`pnpm --filter @mindforge/desktop dev`（构建校验：`pnpm --filter @mindforge/desktop check`）
- Rust Indexer：`cd crates/indexer && cargo build`

## 编码风格与命名约定
- ESLint + Prettier：2 空格缩进、单引号、100 列、`trailingComma: es5`。
- TypeScript 严格；React 18+ 无需显式 `import React`；使用路径别名 `@mindforge/shared/*`、`@mindforge/ui/*`、`@mindforge/mcp-server/*`。
- 命名：组件文件 `PascalCase.tsx`；通用模块/工具小写短名（如 `env.ts`、`logger.ts`）；常量 `UPPER_SNAKE_CASE`。

## 测试指南
- 当前以 smoke/build 校验为主：`pnpm smoke` 或按包运行上述命令。
- 如新增测试：单元测试放 `packages/*/tests/`，端到端测试放 `apps/*/e2e/`，命名如 `foo.spec.ts`。

## 提交与 PR 指南
- 采用 Conventional Commits：`type(scope): summary`。
  - 例：`feat(api): 添加 /env 路由`、`refactor(desktop-ui): 优化主题注入`。
- PR 要求：清晰描述、关联 Issue、UI 变更附截图、自测步骤；合并前需通过 `pnpm lint && pnpm build && pnpm smoke`。

