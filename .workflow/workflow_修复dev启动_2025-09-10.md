# 功能：Monorepo 开发环境修复（UI 类型 + Tauri）

## 核心分析
- **需求目标**: 让 `pnpm dev` 在当前 monorepo 中稳定启动，修复 `packages/ui` 的类型构建失败与 `apps/desktop` 的 Tauri 启动失败。
- **技术选型**: TypeScript 5.x、tsup(dts)、React 19.x（配套 `@types/react`/`@types/react-dom`）、Vite、Tauri 2.8.x、pnpm/turbo。
- **潜在风险**: 
  - React 19 与 DefinitelyTyped 的类型兼容性可能存在细微差异；
  - `tsconfig.base.json` 中 `types` 限定会屏蔽自动类型获取，需统一修正；
  - Windows 上 Tauri 依赖 Rust toolchain 与 MSVC/VS Build Tools；
  - `pnpm install` 时如网络受限会影响验证（可由你本地执行）。

# 任务列表
---

## Phase 1: UI 包类型修复
- [x] **Task 1: 为 `packages/ui` 增加类型依赖**（`@types/react`、`@types/react-dom` 作为 devDependencies）。
- [x] **Task 2: 调整 `tsconfig.base.json`**（在 `types` 中加入 `react`、`react-dom`，或于 `packages/ui/tsconfig.json` 局部覆盖），确保 dts 生成可用。
- [ ] **Task 3: 重新跑 `pnpm --filter @mindforge/ui dev` 验证**；如仍报错，再对 `button.tsx` 做显式 props 类型兜底（仅在必要时）。

## Phase 2: Desktop(Tauri) 启动修复
- [x] **Task 4: 修正 `apps/desktop/src-tauri/Cargo.toml`**（移除不存在的 `features = ["macros"]`）。
- [x] **Task 5: 将 `tauri` 与 `tauri-build` 版本固定为 `2.8.5`**，与 CLI 2.8.x 对齐。
- [ ] **Task 6: 启动验证**：`pnpm --filter @mindforge/desktop dev`，若本机缺少 Rust/MSVC，按文档安装后重试。

## Phase 3: 整体验证与清理
- [ ] **Task 7: 运行 `pnpm dev`**，确认所有包并发启动成功（API、UI、MCP-Server、Desktop、Shared）。
- [ ] **Task 8: 更新本工作流文档状态**；无测试/临时脚本需清理，如有则删除并标记。

---
