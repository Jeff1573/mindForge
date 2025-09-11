# 功能：桌面端图标与构建修复

## 核心分析
- **需求目标**: 生成并纳入版本控制的多平台应用图标，修复 Windows 构建期 icon.ico 缺失导致的 Tauri dev 失败。
- **技术选型**: Tauri v2 CLI 	auri icon、SVG 源图标、pnpm 脚本、Turbo 任务；Windows 下验证构建。
- **潜在风险**: (1) 本地缺少 MSVC/rc 工具可能导致后续打包报错；(2) 占位图标需后续替换；(3) 若引入其他 TOML 清单需校验语法。

# 任务列表
---

## Phase 1: 图标与脚本
- [ ] **Task 1: 创建占位 SVG 源图标 pps/desktop/assets/icon.svg**
- [ ] **Task 2: 使用 	auri icon 生成多平台图标到 pps/desktop/src-tauri/icons/**
- [ ] **Task 3: 在 pps/desktop/package.json 添加 icon:gen 与 icon:regen 脚本**
- [ ] **Task 4: 将 pps/desktop/src-tauri/icons/ 纳入版本控制**

## Phase 2: 构建与校验
- [ ] **Task 5: 清理桌面端 Rust/Node 构建缓存**
- [ ] **Task 6: 运行 pnpm -F @mindforge/desktop dev 验证构建通过**
- [ ] **Task 7: 更新文档与后续替换指引**

---
