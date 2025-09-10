# AI Agent 技术选型方案（桌面端：Tauri + Qdrant）

> 目标：**面试向、可上线的最小可行 Demo**。范式：**ReAct + 工具调用（MCP） + RAG（Qdrant）**。
> 形态：**Tauri 桌面端** + **React(Vite) 前端** + **Node(Fastify/Hono) 后端** + **OpenAI Responses API（remote MCP）**。

---

## 1. 一句话结论
**Tauri + React(Vite) + Node API（Fastify/Hono） + OpenAI Responses API（remote MCP） + LangChain/LlamaIndex + Qdrant Cloud + Langfuse/Sentry**。

---

## 2. 总体架构
```
┌───────────┐    chat/ingest/query     ┌───────────────────────────────┐
│  Tauri    │  ─────────────────────▶  │  Node API (Fastify/Hono)      │
│  (React)  │    SSE/Stream/JSON       │  • /v1/chat  (Responses+MCP)  │
│  桌面UI   │ ◀─────────────────────   │  • /v1/rag/ingest, /query     │
└────┬──────┘                          │  • Auth/Logging               │
     │                                 └─────────────┬─────────────────┘
     │ 文件/剪贴板/通知                           │
     │ (Tauri API)                                 │
     │                                             │
     ▼                                             ▼
┌───────────────┐         embeddings/upsert   ┌──────────────┐
│ Qdrant Cloud  │ ◀────────────────────────── │  Embeddings  │
│ (向量检索)    │  query topK + filter        │  (OpenAI)    │
└───────────────┘                              └──────────────┘
                        tools (remote MCP)
                        ┌───────────────────────────────┐
                        │ MCP Server(s) (Node/托管)      │
                        │  • http_get / github / custom │
                        └───────────────────────────────┘
```

---

## 3. 模块选型与理由
### 3.1 桌面端（Tauri）
- Tauri 2.x：体积小、内存低、安全（allowlist）。
- React + Vite + TypeScript；UI：Tailwind + shadcn/ui；状态：React Query + Zustand。
- **密钥不在前端**，所有模型/RAG/MCP 调用均走后端。

### 3.2 后端（Node 20+）
- Fastify（或 Hono）；OpenAI **Responses API** 为编排核心（含 **remote MCP**）。
- RAG：LangChain/LlamaIndex；切片 512–1024 tokens，10–15% 重叠。
- 观测：Langfuse + Pino + Sentry。

### 3.3 数据层（Qdrant）
- Collection: `docs`；Payload: `docId,title,chunkIndex,source,tenant`；cosine/dot。
- Hybrid：向量（Qdrant）+ 关键词（SQL ILIKE → 可升级 Meilisearch/Typesense）。
- 可选 Rerank：Cohere Rerank/ColBERT（top50→top5）。

### 3.4 MCP 工具层
- 协议：MCP；先用托管/社区工具，再自建 Node MCP Server 封装内部 API。
- Responses `tools` 注册：`{ type: "mcp", server: { url, headers } }`。

---

## 4. 接口设计（MVP）
### 4.1 对话：`POST /v1/chat`
Request 示例：
```json
{
  "messages": [{ "role": "user", "content": "给我总结本项目" }],
  "sessionId": "optional-uuid"
}
```
服务端流程：RAG 判别 → Qdrant 检索 → Responses 编排（含 MCP）→ 流式返回 → Langfuse 记录。

### 4.2 导入：`POST /v1/rag/ingest`
- 文本/文件 → 切片 → 嵌入 → `qdrant.upsert` → `{ ok: true, docId }`。

### 4.3 检索调试：`POST /v1/rag/query`
- 入参：`q, k=5, filters`；返回：片段/分数/来源。

---

## 5. 目录结构（Monorepo）
```
ai-agent/
  apps/
    desktop/            # Tauri + React（桌面）
    web/                # 可选 Web 版
    api/                # Fastify/Hono（Responses + RAG + MCP）
  packages/
    ui/                 # 共享 UI 组件
    shared/             # types、zod schema
    mcp-server/         # 自建 MCP Server
  infra/
    scripts/            # ingest/初始化脚本
```

---

## 6. 环境变量示例（.env）
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
QDRANT_URL=https://<cluster>.cloud.qdrant.io
QDRANT_API_KEY=xxxxx
QDRANT_COLLECTION=docs
MCP_SERVER_URL=https://mcp.example.com/mcp
MCP_API_KEY=dev-mcp-key
LANGFUSE_SECRET_KEY=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_HOST=https://cloud.langfuse.com
```

---

## 7. 依赖清单（精简）
**apps/desktop**
```
react react-dom vite tailwindcss @tanstack/react-query zustand
@tauri-apps/cli @tauri-apps/api class-variance-authority
```
**apps/api**
```
fastify @fastify/cors openai langchain qdrant zod pino langfuse
```
**packages/mcp-server**
```
typescript zod undici @modelcontextprotocol/sdk
```

---

## 8. 关键代码（伪）
### /v1/chat（Responses + RAG + MCP + 流）
```ts
const hits = maybeNeedRAG(userText) ? await qdrantSearch(userText, 6) : [];
const context = hits.map((h,i)=>`【${i+1}】${h.text}`).join("\n\n");
const resp = await openai.responses.stream({
  model: process.env.OPENAI_MODEL,
  input: [
    { role: "system", content: [{ type: "input_text", text: "你是 helpful 的助手，使用引用编号给出处。" }] },
    { role: "user", content: [
      { type: "input_text", text: userText },
      ...(context ? [{ type: "input_text", text: `\n\n【可用资料】\n${context}` }] : [])
    ] }
  ],
  tools: [{ type: "mcp", server: { url: process.env.MCP_SERVER_URL, headers: { "x-api-key": process.env.MCP_API_KEY } } }]
});
return resp.toReadableStream();
```

### Qdrant 检索（LangChain）
```ts
const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
await client.upsert(COLLECTION, points);
const res = await client.search(COLLECTION, { vector: await embed(query), limit: 8, filter: { must: [{ key: "tenant", match: { value: tenantId }}] } });
```

---

## 9. 安全与工程细节
- 密钥只在后端；Tauri/前端不存放模型密钥。
- MCP 工具白名单；写操作二次确认。
- Qdrant 检索强制 tenant/user 过滤；日志脱敏。
- 对外部返回做 Sanitization；固定系统提示模板。
- Langfuse 记录对话/工具轨迹；Sentry 捕获错误。

---

## 10. 开发里程碑（2 天）
1) D1 上午：/v1/chat 流式通；D1 下午：Qdrant 导入/检索 + 引用展示。
2) D2 上午：接 remote MCP（http_get 工具）；D2 下午：Langfuse + Tauri 打包。

---

## 11. 面试话术（30 秒）
> 选择 **Tauri** 获取更小体积与更低内存；**React+Vite** 做 UI；后端 **Node(Fastify)** 以 **OpenAI Responses API** 为编排核心并通过 **remote MCP** 标准化工具调用；**Qdrant** 负责向量检索，支持 Hybrid 与引用展示；**Langfuse** 贯穿可观测。方案与 2025 主流一致且可在两天内落地。
