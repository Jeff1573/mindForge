# 功能：Rust 索引扫描器

## 核心分析
- **需求目标**：实现高性能“仓库文件扫描器”（库 + CLI），遍历指定根目录，合并 `.gitignore` 与自定义 `.indexignore` 与额外忽略规则，过滤二进制与超大文件，输出标准化 POSIX 相对路径的 NDJSON 结果，供 API/Tauri 后续建索引使用。
- **范围（In/Out）**：
  - In：遍历与忽略规则解析；二进制识别（扩展名启发式 + 4KB 采样 NUL 检测）；最大尺寸过滤；并发控制；相对路径统一为 `/` 分隔；CLI 参数解析与错误码；最少 3 个验收用例脚本。
  - Out：嵌入向量生成/入库（如 Qdrant）；文件内容全文读取与分片；增量/监听；API 路由对外暴露（本迭代仅保留可选任务）。
- **技术选型**：
  - 语言/工具：Rust stable（≥1.80），`cargo`。
  - 库：`ignore`（遍历与 .gitignore 规则）、`content_inspector`（二进制检测采样）、`clap`（CLI）、`serde`/`serde_json`（NDJSON 输出）、`anyhow`（错误）、`thiserror`（必要时）、`time`（时间戳处理，可选）。
  - 产物：独立 crate `crates/indexer`（库 `mindforge_indexer` + 二进制 `mf-indexer`）。
  - CI：`cargo fmt`、`cargo clippy -D warnings`、`cargo check`；通过 monorepo 脚本串联。
- **非功能需求**：
  - 性能：典型仓库（≤50k 文件）在 SSD 上扫描时间目标 ≤ 5s；CPU/IO 可控，并发默认 64。
  - 安全：仅在指定 `root` 下相对遍历；不跟随符号链接（默认）；读取采样 ≤4KB；错误透明输出到 stderr。
  - 可运维：明确退出码（0 成功；非 0 失败）；日志最小化；输出稳定字段。
- **依赖与前置**：
  - 开发环境安装 Rust 工具链；仓库根允许新增 `crates/indexer`。
  - Windows/Unix 路径差异通过输出层统一为 POSIX，相对 `root` 判定。
- **潜在风险**：
  - 路径规范与 `ignore` 规则优先级（含 `!` 取反）误判；
  - 大仓库文件句柄/并发导致的 IO 拥塞；
  - 符号链接/循环引用；
  - 误判文本与二进制边界文件（如 UTF-16/BOM）。

# 任务列表
---

## Phase 1: Crate 骨架与依赖
- [x] **Task 1: 创建 `crates/indexer`（库+CLI）与 `Cargo.toml` 基础配置**
- [x] **Task 2: 引入依赖并配置 `clippy`/`fmt`/`check` 脚本**
- [x] **Task 3: README 初稿与示例命令占位**

## Phase 2: 忽略规则模块
- [x] **Task 4: 实现 `load_ignore(root, extra)` 合并 `.gitignore`/`.indexignore`/extra**
- [x] **Task 5: 规则判定函数（相对路径 POSIX 化，支持 `!`）与单元用例**

## Phase 3: 扫描与二进制检测
- [x] **Task 6: `is_binary_file(path, sample=4096)` 扩展名启发 + NUL 采样**
- [x] **Task 7: `scan_repo(config)` 集成 `ignore::WalkBuilder` 并发遍历与 `max_size` 过滤**
- [x] **Task 8: 路径归一化、时间戳/尺寸读取与记录结构定义**

## Phase 4: 库导出与 CLI
- [x] **Task 9: 导出公共 API（类型/错误）并补充文档**
- [x] **Task 10: `mf-indexer` CLI 参数解析与 NDJSON 输出（逐行）**
- [x] **Task 11: 错误处理与退出码约定（0/非0）**

## Phase 5: 验收与用例
- [x] **Task 12: `.gitignore` + `.indexignore` 生效用例**
- [x] **Task 13: 二进制识别用例（含 UTF-16/含 NUL 对比）**
- [x] **Task 14: `max_size` 与路径统一用例**
- [x] **Task 15: README 验收说明与示例输出**

## Phase 6: API 集成（暂缓，本迭代不做）
- [ ] **Task 16: 在 `apps/api` 增加 `GET /index/scan` 路由（流式 NDJSON）** [deferred]
- [ ] **Task 17: 安全策略（root 白名单、超时/取消）与文档** [deferred]

---

## 变更记录
- 2025-09-12T00:00Z：创建任务拆分文档（初稿），确定以 Rust crate（库+CLI）实现，API 集成为可选阶段。
- 2025-09-12T00:10Z：根据反馈将 Phase 6 标记为本迭代暂缓（仅本机索引通过 CLI 调用）。
- 2025-09-12T00:25Z：完成 Phase 1（crate 骨架、依赖与 README 初稿）；`cargo check` 通过。
