# MindForge Monorepo

> 桌面端（Electron + Vite + React）与后端（Fastify），含 packages：shared / ui / mcp-server。

## 先决条件
- Node.js ≥ 20（建议启用 Corepack）
- npm（Node.js 内置）
- 可选：如需构建 `crates/indexer`，请安装 Rust（稳定版）并使用 `cargo build`

## 环境变量
复制根目录 `.env.example` 为 `.env` 并按需填写：
- AI_PROVIDER（gemini/openai）、AI_MODEL、AI_API_KEY
- OPENAI_*（仅当 AI_PROVIDER=openai 时生效）
  - OPENAI_BASE_URL（可选，OpenAI/兼容服务 base URL，需包含 /v1；优先级：运行参数 baseURL > OPENAI_BASE_URL > AI_BASE_URL；为空则按默认 OpenAI）
  - OPENAI_API_KEY（优先于 AI_API_KEY）
  - OPENAI_MODEL（优先于 AI_MODEL）
- QDRANT_URL、QDRANT_API_KEY、QDRANT_COLLECTION（默认 docs）
- MCP_SERVER_URL、MCP_API_KEY（可选）

## 安装依赖
```
npm install
```

## 在不同 workspace 安装依赖（npm）

> 所有命令均在仓库根目录执行。使用 `-w|--workspace <name>` 指定目标工作区。

常用命令示例：

```bash
# 安装到 Desktop（生产依赖）
npm i <pkg> -w @mindforge/desktop

# 安装到 Desktop（开发依赖）
npm i -D <pkg> -w @mindforge/desktop

# 安装到 API（生产依赖）
npm i <pkg> -w @mindforge/api

# 引用本地包（workspace 协议）
npm i @mindforge/ui@workspace:* -w @mindforge/desktop
npm i @mindforge/mcp-server@workspace:* -w @mindforge/api
```

Electron 原生模块（仅 Desktop）

```bash
# 安装原生模块后，为当前 Electron 版本重建
npm i <native-pkg> -w @mindforge/desktop
npm exec -w @mindforge/desktop electron-rebuild
```

注意事项：
- 根级执行 npm 命令统一管理依赖；如遇缺包，先执行一次 `npm install`
- Desktop 主进程使用 CommonJS；若依赖为 ESM-only，可采用 `await import('<pkg>')` 动态导入

## 开发调试
- 并行启动 API 与 Desktop：
```
npm run dev
```
- 仅启动 API：
```
npm run dev --workspace=@mindforge/api
```
- 仅启动 Desktop（Electron + Vite 一体开发）：
```
npm run dev --workspace=@mindforge/desktop
```

### OpenAI 配置连通性测试（兼容网关）

- 用途：验证 `OPENAI_BASE_URL`（需包含 `/v1`）、`OPENAI_API_KEY`、`OPENAI_MODEL` 等是否被正确解析，并能连通兼容的 `/v1/chat/completions` 与 `/v1/models`。
- 命令：

```bash
# 环境变量示例（请替换为你的实际值）
AI_PROVIDER=openai \
OPENAI_BASE_URL=https://your-proxy.example.com/v1 \
OPENAI_API_KEY=sk-xxx \
OPENAI_MODEL=gpt-4o-mini \
npm run test:openai

# 仅查看解析（不触网）
npm run test:openai -- --dry-run --verbose

# 仅测试 /v1/models
npm run test:openai -- --models-only
```

- 判据：任一接口连通即视为“已生效并可用”。脚本会输出分类诊断（鉴权/网络/模型名/路由）。
- 一致性：脚本内置桌面端 provider 解析规则（OPENAI_MODEL/OPENAI_API_KEY/OPENAI_BASE_URL 的优先级）一致性检查，发现差异会提示修复建议。

### 桌面端 Provider 选择规则

- 仅当 `AI_PROVIDER=openai` 时，读取 `OPENAI_*` 并支持自定义 `baseURL`；否则忽略 `OPENAI_*`。
- 当 `AI_PROVIDER` 为 `gemini` 或 `google` 时，仅使用 `AI_API_KEY` 和 `AI_MODEL` 构建 Gemini 模型（不再读取 `GOOGLE_API_KEY/GEMINI_API_KEY`）。
- 其他 provider 暂未内建（按需扩展）。
- 调试：设置 `LLM_DEBUG=1` 可在初始化时输出一次脱敏摘要（provider/model/baseURL/key）。

### Agent 执行日志（结构化大纲 + Final Result）

- 在应用界面「Agent 测试（调用 agent:react:invoke）」卡片中输入一段提示并点击“执行”。
- 运行结束后，在卡片下方可查看两部分：
  - 步骤大纲：按步骤分组、默认折叠；异常步骤自动高亮并展开；支持“全部展开/折叠”“尾随”开关（接近底部时自动滚动）。
  - 最终结果（Final Result）：按 Markdown 完整渲染，并提供“一键复制”。

#### 实验性开关：结构化日志视图

- 默认开启。可在卡片标题右侧的“结构化视图”开关控制显示；也可通过本地存储开关：

```js
// 开启（默认）
localStorage.setItem('mf.agentLogOutline.enabled', '1')
// 关闭
localStorage.setItem('mf.agentLogOutline.enabled', '0')
```

- 关闭后仅保留原始行级文本日志（便于对比或排障）。

## 构建
- 构建所有：`npm run build`
- 构建 Desktop 前端与主进程：`npm run build --workspace=@mindforge/desktop`

## 工作区结构
- apps/desktop：Electron + Vite + React
- apps/api：Fastify + TypeScript
- packages/shared：环境变量与通用工具
- packages/ui：UI 组件
- packages/mcp-server：MCP 服务骨架

## 版本基线（2025-09-10）
见 `.workflow/workflow_初始化与基础设施_2025-09-10.md`。

## Git 忽略策略（集中管理）
- 根级 `.gitignore` 统一覆盖子包（Turborepo）。
- 关键范围：`**/node_modules/`, `**/dist/`, `**/.turbo/`, `**/.vite/`, `**/.cache/`, `**/*.tsbuildinfo`。
- Rust（可选）补充：`**/target/**`；建议提交 `Cargo.lock`。
- 环境文件：忽略 `.env` 与 `.env.*`，保留 `.env.example`。
- IDE/OS：忽略 `.vscode/`、`.idea/`、`.DS_Store`、`Thumbs.db`。

## MCP 使用（简述）
- 详见 `apps/desktop/electron/mcp/README.md` 与 `apps/desktop/mcp.json`。
