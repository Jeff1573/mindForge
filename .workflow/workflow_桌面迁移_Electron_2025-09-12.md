# 功能：桌面端从 Tauri 原地迁移至 Electron

## 核心分析
- **需求目标**：用 Electron 替代现有 Tauri 框架，保留/复用 Vite + React 界面与业务代码；仅保留窗口控制能力，其余 Tauri API 全部移除；清理项目中所有 Tauri 相关资产与依赖。
- **范围（In/Out）**：
  - In：Electron 主/预加载/渲染器脚手架；窗口控制最小化/最大化/还原/关闭；UI 复用；移除 Tauri 目录与依赖；基本打包与本地验证；与 Rust indexer 的子进程集成（开发/生产路径处理）。
  - Out：自动更新、代码签名、应用商店分发、系统托盘/菜单栏/剪贴板/通知等高级集成（后续如需再立项）。
- **技术选型**：Electron 27+；`electron-vite`（或 `vite-plugin-electron`）统一主/预加载/渲染器构建；`electron-builder` 打包；语言 TypeScript；Monorepo 维持 pnpm + Turborepo；类型与常量放置在 `packages/shared`。
- **非功能需求**：
  - 开发体验：`pnpm dev` 一键并行，渲染器支持 HMR。
  - 安全：`contextIsolation: true`、禁用 `nodeIntegration`，仅通过 `preload` 暴露白名单 API。
  - 质量：`pnpm lint && pnpm build && pnpm smoke` 需通过。
- **依赖与前置**：Node 18+；保留 Rust indexer 源码与构建产物；Windows 为主要目标平台（后续可扩展）。
- **潜在风险**：体积增加；子进程与路径解析（含空格）复杂；关闭时子进程清理；打包后资源定位差异；短期功能缺口需要 UI/交互兜底。

# 任务列表
---

## Phase 1: Electron 脚手架与构建接入
- [ ] **Task 1: 在 `apps/desktop` 接入 Electron 脚手架**（新增 `electron/main.ts`、`electron/preload.ts`、`build/` 目录与图标）
- [ ] **Task 2: 配置构建链**（`electron-vite` 或 `vite-plugin-electron`，与现有 Vite 渲染器整合）
- [ ] **Task 3: 更新 `apps/desktop/package.json` 脚本**（`dev`/`build`/`lint`/`start`），对齐 Turborepo pipeline

## Phase 2: 渲染器迁移与窗口控制改写
- [ ] **Task 4: 复用与迁移 React 渲染器代码**（保留 `src/**`，适配入口）
- [ ] **Task 5: 用 Electron 改写 `ui/system/WindowControls.tsx`**（最小化、最大化/还原、关闭），通过 `preload` 暴露 API
- [ ] **Task 6: 替换 `src/lib/platform.ts` 等 Tauri 依赖**（统一通过 `window.api.*` 访问）

## Phase 3: Rust Indexer 子进程集成
- [ ] **Task 7: 在主进程用 `child_process.spawn` 调用 `crates/indexer`**（开发/生产路径区分、stdout/stderr 流式转发）
- [ ] **Task 8: 进程生命周期与异常处理**（应用退出时清理子进程，错误回传渲染器）

## Phase 4: 移除 Tauri 与资产清理
- [ ] **Task 9: 删除 `apps/desktop/src-tauri/**`、`tauri.conf.json`、`Cargo.*` 等文件**（完全移除 Tauri）
- [ ] **Task 10: 移除 Tauri 依赖与脚本**（更新 `package.json`、`pnpm-lock.yaml`、`turbo.json`、`pnpm-workspace.yaml` 相关配置）
- [ ] **Task 11: 迁移图标至 `apps/desktop/build/icons/` 并更新打包配置**

## Phase 5: 打包与验证
- [ ] **Task 12: 配置 `electron-builder`（Windows x64）并产出安装包**
- [ ] **Task 13: 本地安装与运行验证**（窗口控制、索引器调用、基础导航）
- [ ] **Task 14: 对齐仓库命令**（`pnpm dev/build/lint/smoke` 在 Monorepo 下全部通过）

## Phase 6: 文档与交付
- [ ] **Task 15: 更新 `README.md` 与 `docs/`**（开发调试、打包发布、注意事项）
- [ ] **Task 16: 清理测试/临时脚本并标记“清理完成”**

---

## 变更记录
- 2025-09-12T00:00Z：创建迁移工作流文档，确定原地替换方案与分阶段任务。


