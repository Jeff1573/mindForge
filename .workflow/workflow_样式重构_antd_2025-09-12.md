# 功能：样式重构（antd 作为唯一方案）

## 核心分析
- **需求目标**：以 antd v5 为唯一 UI/样式体系，完整替换 Tailwind 与 shadcn/ui，保留并用 antd/原生 CSS 实现现有主题、平台化与特效（玻璃拟物、气泡等），支持系统主题跟随并启用 antd CSS 变量。
- **范围（In/Out）**：
  - In：接入 antd（含 `ConfigProvider` 与 `cssVar`）；替换 Button/Input/Textarea/Separator/Scroll 容器等；重写 `index.css` 去除 Tailwind 指令与 `@apply`；主题令牌映射到 antd token；保留并复写定制样式；移除 Tailwind 与 shadcn/ui 依赖/文件/工具；文档与脚本更新；基本回归测试与可达性核对。
  - Out：引入全新复杂业务组件（表格、日期等）超出现有界面；设计大改（保持现有主题观感为先）。
- **技术选型**：
  - 前端：React 18 + Vite + Tauri 桌面；UI：antd v5（`ConfigProvider`、`theme.cssVar: true`）。
  - 样式：原生 CSS（保留现有 HSL 令牌与平台变量）；antd token 映射；全局引入 `antd/dist/reset.css`。
  - 工具：移除 `tailwindcss`、`prettier-plugin-tailwindcss`、`eslint-plugin-tailwindcss`；保留 ESLint/Prettier 其余配置。
- **非功能需求**：
  - 性能：首屏允许少量 CSS-in-JS 注入开销；避免明显闪烁（必要时服务端预注入 style 标记，后续再议）。
  - 可达性：焦点环、对比度沿用语义令牌；antd 组件默认可达性基线良好。
  - 可运维：主题切换与平台变量逻辑延续；不影响 Tauri 打包流程。
- **依赖与前置**：
  - 新增依赖：`antd`、`@ant-design/icons`。
  - 网络与私有源：需要可用的 npm 网络安装依赖。
  - 现状核对：入口为 `apps/desktop/src/main.tsx`，全局样式在 `apps/desktop/src/index.css`。
- **潜在风险**：
  - 视觉回归：组件风格与现有有细微差异；需逐屏微调 hover/active/ring 可见性。
  - 运行时注入：CSS-in-JS 可能带来首帧样式闪烁；需观察 Tauri 环境表现。
  - 令牌一致性：短期静态映射可能与 HSL 变量存在偏差；可追加“动态桥接（从 CSS 变量读取并注入 antd token）”。

# 任务列表
---

## Phase 1: 接入 antd 与主题桥接
- [x] **Task 1: 安装依赖与全局样式**（添加 `antd`、`@ant-design/icons`；在入口引入 `antd/dist/reset.css`）
  - 变更：`apps/desktop/package.json` 新增依赖；`apps/desktop/src/main.tsx` 引入 reset 样式。
  - 说明：网络受限未实际安装；待本地执行：`pnpm -C apps/desktop add antd @ant-design/icons`。
- [ ] **Task 2: 新增 AntdThemeProvider**（基于现有 `theme.ts` 监听系统与本地偏好，设置 `ConfigProvider` 的 `algorithm: light/dark`、`cssVar: true`、`token` 初始映射）
- [x] **Task 2: 新增 AntdThemeProvider**（基于现有 `theme.ts` 监听系统与本地偏好，设置 `ConfigProvider` 的 `algorithm: light/dark`、`cssVar: true`、`token` 初始映射）
  - 新增：`apps/desktop/src/ui/system/AntdThemeProvider.tsx`（通过 MutationObserver 监听 html 的主题变更；从 CSS 变量读取 HSL 值映射到 antd token；开启 cssVar）。
- [x] **Task 3: 入口接入**（在 `main.tsx` 用 `AntdThemeProvider` 包裹 `<App />`，保持 `initTheme()` 以驱动 `data-theme` 与 `class=dark`）

## Phase 2: 组件替换（Button/Input/Textarea/Separator/Scroll）
- [x] **Task 4: Button 替换**（`components/ui/button.tsx` 的使用点统一替换为 `antd/Button`，`ThemeToggle`、`WindowControls`、`ChatPanel`、`Sidebar` 调整）
  - 变更：上述文件改为 `import { Button } from 'antd'`；移除不兼容的 `size="icon"/variant`，统一使用 `type="text"` 并保留 `window-btn` 等语义类。
- [x] **Task 5: Input/Textarea 替换**（`ChatInput` 改为 `Input.TextArea` + `Button`；移除 `components/ui/input.tsx`、`textarea.tsx`）
  - 变更：`ChatInput` 使用 `antd` 的 `Input.TextArea` 与 `Button`；后续在 Phase 4 删除自定义 Input/Textarea 源码。
- [x] **Task 6: Separator 替换**（`Separator` → `antd/Divider`，调整布局间距）
  - 说明：项目中未发现实际使用 `Separator`；后续在清理阶段直接删除文件。
- [x] **Task 7: Scroll 替换**（`ScrollArea` 去除 Radix 封装，改用原生滚动容器 + 现有滚动条 CSS）
  - 变更：`MessageList` 去除 Radix ScrollArea，改用原生 `overflow-auto` 容器；全局滚动条样式保持。

## Phase 3: 样式重写与令牌对齐
- [x] **Task 8: 清理 `index.css` 的 Tailwind 指令与 `@apply`**（等价还原 `.panel/.card/.toolbar/.surface-glass/.bubble-*` 等为纯 CSS）
  - 变更：移除 `@tailwind` 指令，重写组件样式与 `window-btn/titlebar` 等；补充 `.mf-*` 最小语义类与 `.sr-only`。
- [x] **Task 9: 令牌别名与对齐**（保留 `--color-*`/`--radius-*`；可选将关键色映射到 `--ant-*-token` 或在 `ConfigProvider.theme.token` 设置）
  - 变更：`AntdThemeProvider` 从 `--color-*` 读取 HSL 注入 `colorPrimary/colorBgBase/colorTextBase/colorBorder/borderRadius`。
- [x] **Task 10: 平台变量复核**（`data-platform` 变量继续生效：`--fx-blur/--panel-opacity/--window-btn-gap` 等；容器查询工具类以纯 CSS 保留）
  - 说明：保留 `html[data-platform=*]` 变量与 `@supports(backdrop-filter)` 能力探测；`.cq/.cq-name` 以原生 CSS 提供。

## Phase 4: 清理 Tailwind/shadcn 与工具配置
- [x] **Task 11: 删除 Tailwind 与 shadcn 相关文件**（`tailwind.config.ts`、`postcss.config.cjs` 中 Tailwind 插件、`components/ui/*`、`src/lib/utils.ts` 中与 Tailwind 强相关工具如无用则清理）
  - 变更：删除 `apps/desktop/tailwind.config.ts` 与 `src/components/ui/*`；`postcss.config.cjs` 去除 tailwind 插件；`utils.ts` 移除 `tailwind-merge`。
- [x] **Task 12: 依赖与脚本清理**（移除 `tailwindcss`、`prettier-plugin-tailwindcss`、`eslint-plugin-tailwindcss`；更新 README 样式章节为 antd 方案）
  - 变更：`apps/desktop/package.json` 移除 Radix/cva/tailwind-merge/tailwindcss；根 `package.json` 移除 tailwind 相关插件；README 更新为 antd 方案。
- [ ] **Task 13: Lint/类型检查/格式化**（`pnpm lint`、`pnpm format`、`tsc --noEmit`）

## Phase 5: 回归与验收
- [ ] **Task 14: 主题与系统跟随验证**（浅/深切换一致；系统切换触发 antd 主题同步）
- [ ] **Task 15: 界面巡检与交互可达性**（标题栏拖拽、窗口按钮、移动端抽屉、滚动条、容器查询、聊天气泡）
- [ ] **Task 16: 清理与交付**（删除测试/临时脚本；在文档标记“清理完成”）

---

## 变更记录
- 2025-09-12T00:00Z：创建任务拆分文档；明确 antd 接入方案、阶段与风险。
- 2025-09-12T00:30Z：修复浅色主题下文本按钮 hover 可见性（AntdThemeProvider 注入 Button 组件 token；`index.css` 添加 `.ant-btn-text:hover/active` 覆盖）。
