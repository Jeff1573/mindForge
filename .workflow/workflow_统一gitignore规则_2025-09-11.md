# 功能：统一 gitignore 规则

## 核心分析
- **需求目标**: 在仓库根集中维护一份 `.gitignore`，覆盖 Turborepo + pnpm + Tauri(Rust) + Vite(TypeScript) 的单仓多包结构，忽略构建产物、缓存和本地环境文件，保留必要的锁文件与配置示例。
- **技术选型**: Gitignore 通配符与目录规则；集中管理（根级 `.gitignore`）；面向 pnpm、Vite、Tauri/Rust、Turbo 缓存；OS 级临时文件（Windows/macOS/Linux）。
- **潜在风险**: 误忽略应提交文件（如部分编辑器配置）；仓库历史中已跟踪的产物需配合 `git rm --cached` 清理；子包若已有 `.gitignore` 可能需要合并或移除以避免冲突；完全忽略 `.vscode/` 可能影响共享团队设置（按你的选择执行）。

# 任务列表
---

## Phase 1: 规则拟定与评审
- [x] **Task 1: 汇总各技术栈需忽略清单（pnpm、Vite、Tauri/Rust、Turbo、OS）**
- [x] **Task 2: 拟定根级 `.gitignore` 规则（集中管理，`.vscode/` 全部忽略，`.env*` 全忽略并保留 `.env.example`）**

## Phase 2: 实施与验证
- [x] **Task 3: 在仓库根添加/更新 `.gitignore`，为关键规则添加注释**
- [x] **Task 4: 清理历史已跟踪的产物与缓存（`git rm -r --cached` 等）并验证生效**
- [x] **Task 5: 合并/移除子包冗余 `.gitignore`（如存在），确保以根规则为准**

## Phase 3: 文档与交付
- [x] **Task 6: 在 README/内部文档补充忽略策略与常见问题**
- [x] **Task 7: 你确认完成后，如有临时/测试脚本则删除，并在本文档标记收尾**

收尾说明：
- 本功能实施过程中未创建任何临时/测试脚本，无需删除。
- 后续如需要调整忽略策略，请直接修改根级 `.gitignore` 并在此文档补充变更记录。

---
