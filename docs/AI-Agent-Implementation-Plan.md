# AI Agent 桌面端实现流程指南（Tauri + Qdrant）

本文档给出一个从零到可演示的实现顺序，每一步包含目标产物、关键实现点、验收标准和常见坑。

---

## 0) 初始化 & 基础设施
**目标产物**：Monorepo 骨架 + 环境变量就绪  
**要做**：
- 建仓：`apps/desktop`(Tauri+Vite+React), `apps/api`(Fastify/Hono), `packages/mcp-server`, `packages/ui`, `packages/shared`  
- `.env`：`OPENAI_API_KEY`, `OPENAI_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `MCP_SERVER_URL`, `MCP_API_KEY`  
- Qdrant Cloud 创建 `docs` collection（cosine/dot，payload: `docId,title,chunkIndex,source,tenant`）  
**验收**：依赖能安装，前后端能本地起服务。

---

## 1) 后端最小对话（无 RAG/MCP）
**目标产物**：`POST /v1/chat`——调用 **OpenAI Responses API**，**流式返回**  
**要做**：
- Fastify 起路由；用 `openai.responses.stream()` → 转为 SSE/分块返回  
- 前端写简单 Chat UI 验证流式  
**验收**：输入“你好”，前端逐 token 出字  
**坑**：不要把密钥放前端，注意跨域。

---

## 2) RAG：导入与检索（Qdrant）
**目标产物**：`/v1/rag/ingest`、`/v1/rag/query`  
**要做**：
- 切片：递归字符 splitter（800 tokens 左右，overlap 100）  
- 嵌入：`text-embedding-3-large`  
- 入库：`qdrant.upsert()`；检索：`search(limit=5~8)` + MMR  
- 桌面端：Tauri 文件选择 → 调 `/ingest`  
**验收**：导入文本后，检索能命中多条结果。

---

## 3) 对话中接入 RAG 引用
**目标产物**：对话中命中资料 → 回答带引用编号  
**要做**：
- 在 `/v1/chat` 中：先检索 → 拼上下文到 `input`  
- 前端 UI：展示引用卡片  
**验收**：问项目相关问题，能返回答案 + 引用编号。

---

## 4) 接入 MCP 工具（最小一个）
**目标产物**：对话中能触发 **remote MCP** 工具  
**要做**：
- `packages/mcp-server` 起一个最小 MCP Server（例如 `http_get`）  
- 在 Responses 调用注册 `tools: [{ type: "mcp", server: { url, headers } }]`  
- 前端：展示“工具调用日志”  
**验收**：能抓取 URL 标题并显示工具调用过程。

---

## 5) 桌面壳（Tauri）接入与文件能力
**目标产物**：桌面应用可运行、可导入文件、可聊天  
**要做**：
- Tauri 加载前端构建产物；配置 `allowlist`  
- 导入文件走 Tauri `dialog.open` → `/ingest`  
**验收**：桌面版与 Web 版一致，能导入文件后提问。

---

## 6) 混合检索 & Rerank（可选）
**目标产物**：Hybrid（语义 + 关键词），可选 rerank  
**要做**：
- 关键词侧：先 SQL ILIKE；后可接 Meilisearch/Typesense  
- Rerank：Cohere Rerank/ColBERT  
**验收**：专有名词或弱语义查询命中率更好。

---

## 7) 可观测与日志
**目标产物**：Langfuse 中有完整链路  
**要做**：
- 在 `/v1/chat` 各阶段打点：输入、检索、工具、输出  
- 错误走 Sentry，日志走 Pino  
**验收**：Langfuse 可回放完整会话。

---

## 8) 打包与发布
**目标产物**：Tauri 安装包 + API 部署  
**要做**：
- Tauri bundler 生成安装包；GitHub Actions 出三平台产物  
- API 部署到 Railway/Render/Fly.io  
- Qdrant 用 Cloud  
**验收**：安装包能运行；无网络时有清晰报错。

---

## ✅ 最小测试用例清单
- [ ] `/v1/chat` 返回流式 token  
- [ ] `/v1/rag/ingest` 导入 1 万字文本成功  
- [ ] `/v1/rag/query` 命中 ≥3 条  
- [ ] 对话命中 RAG 并附引用编号  
- [ ] MCP `http_get` 工具调用成功  
- [ ] 桌面端能选择文件并导入  
- [ ] Hybrid 提升关键词召回率  
- [ ] Langfuse 可见完整链路  
- [ ] 桌面安装包可运行、提示网络错误  

---

## 常见坑
- **卡顿**：检索/工具并发执行，引用延迟补充。  
- **上下文过长**：限制片段 token，必要时裁剪。  
- **工具滥用**：系统提示限制，服务端加速率限制。  
- **密钥安全**：全部在后端管理。

---

## 开发里程碑（2 天）
- **D1 上午**：后端 `/v1/chat` 流式通；  
- **D1 下午**：Qdrant 导入/检索 + 引用展示；  
- **D2 上午**：接入 MCP 工具；  
- **D2 下午**：Langfuse 打点 + Tauri 打包。
