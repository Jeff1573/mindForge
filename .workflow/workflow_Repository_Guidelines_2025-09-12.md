# 功能：Repository Guidelines（AGENTS.md）

## 核心分析
- **需求目标**：在仓库根目录新增贡献者指南 `AGENTS.md`，提供精炼、可执行的协作规范。
- **范围（In/Out）**：In：项目结构说明、开发/构建/校验命令、编码与命名规范、测试指引（现以 smoke/build 为主）、提交与 PR 规范（Conventional Commits）。Out：不引入或配置单测框架、不新增外部依赖。
- **技术选型**：Markdown 文档；内容基于当前 monorepo（pnpm + Turborepo），应用/包：`apps/*`、`packages/*`、Rust `crates/*`。
- **非功能需求**：200–400 字；语气专业、指令化；示例具本仓库路径与脚本；与 README 协同不冲突。
- **依赖与前置**：无额外依赖；参考现有脚本与目录结构（`package.json`、`turbo.json`）。
- **潜在风险**：与 README 重复或冲突；后续结构变更导致文档过时；跨平台命令表述不清。

# 任务列表
---

## Phase 1: 内容设计
- [x] **Task 1: 明确章节结构与要点**（结构/命令/风格/测试/提交）
- [x] **Task 2: 拟定 200–400 字中文文案**（标题英文，正文中文，含命令与路径示例）

## Phase 2: 提交与验证
- [x] **Task 3: 新增根级 `AGENTS.md`**（命名与标题为“Repository Guidelines”）
- [x] **Task 4: 自检与校对**（命令与路径有效；与 README 一致；强调 Conventional Commits）

---

## 变更记录
- 2025-09-12T00:00Z：创建任务文档（明确范围与步骤）。
- 2025-09-12T00:10Z：完成 AGENTS.md，已自检通过；无临时脚本需要清理（清理完成）。
