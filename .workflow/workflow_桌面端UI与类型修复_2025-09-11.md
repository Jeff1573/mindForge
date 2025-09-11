# 功能：桌面端 UI 与类型修复

## 核心分析
- **需求目标**: 解决运行窗口无样式按钮与编辑器 JSX/React 类型报错，使开发与构建稳定可用。
- **技术选型**: Tailwind v3 + PostCSS 流程（Vite）、安装 `@types/react`/`@types/react-dom`、最小改动的 shadcn 按钮样式。
- **潜在风险**: Tailwind v4 的配置差异较大，若后续升级需按官方文档迁移；如有其他包依赖 v4，需要评估影响（当前仓库无）。

# 任务列表
---

## Phase 1: 类型与配置
- [x] **Task 1: 安装 React 类型包并验证 TS 无错误**
- [x] **Task 2: 校验 `tsconfig` JSX 设置（继承基座 `react-jsx`）**

## Phase 2: 样式管线
- [x] **Task 3: 切换到 Tailwind v3 并添加 `postcss.config.cjs`**
- [x] **Task 4: 新增 `tailwind.config.ts` 并配置扫描路径**
- [x] **Task 5: 将 `index.css` 改为 `@tailwind base/components/utilities` 指令**
- [x] **Task 6: 移除 v4 专用 Vite 插件并恢复 Vite 配置**

## Phase 3: 组件与验证
- [x] **Task 7: 调整 Button 变体（移除 `border-input`，使用 `border-neutral-200`）**
- [x] **Task 8: `vite build` 与 `tsc --noEmit` 验证通过**

---

