# MCP 客户端（基于官方 TypeScript SDK）

本模块在 Electron 主进程内提供基于 `@modelcontextprotocol/sdk` 的 MCP 客户端封装，支持三种传输：

- stdio：通过子进程的 stdin/stdout 通信；
- streamable-http：遵循 MCP Streamable HTTP 规范；
- sse：兼容旧版 HTTP+SSE 服务器（当 HTTP 返回 4xx 时自动回退）。

## IPC 接口（主进程）

- `mcp/create(spec)`：按传入的会话规格创建但不连接。返回 `{ id }`。
- `mcp/createFromConfig(configPath?)`：按 mcp.json 批量创建（不连接）。返回 `{ ids }`。
- `mcp/start(id)`：建立连接（对 HTTP 自动回退到 SSE）。
- `mcp/initialize(id)`：返回握手信息 `{ protocolVersion, capabilities, serverInfo, instructions? }`。
- `mcp/listTools(id, cursor?)`：列出工具（支持分页）。
- `mcp/callTool(id, name, args?)`：调用工具。
- `mcp/stop(id)`：关闭连接并清理。

事件（从主进程转发到渲染进程）：

- `mcp:tools:listChanged`：工具列表变化。
- `mcp:stream:data`：原始通知流。
- `mcp:log`：日志。
- `mcp:error`：错误。
- `mcp:close`：连接关闭。

## mcp.json 路径优先级

1. 用户显式指定的路径（`mcp/createFromConfig(configPath)` 的参数）；
2. 环境变量 `MF_MCP_CONFIG` 指定的路径；
3. 当前工作目录 `./mcp.json`。

## 启动期自连接（Electron 主进程）

- 自 v0.1.0 起，应用在 `app.whenReady()` 后后台并发读取 mcp.json 并尝试连接所有服务器：依次执行 `start → initialize`。
- 超时策略：单个会话每一步 10s 超时（静默失败，不阻断应用与其它会话）。
- 事件转发：`tools:listChanged/notification/log/error/close` 会被透传到当前窗口，供渲染端监听。
- 清理：`before-quit` 钩子会迭代 `stop()` 所有自启动会话，并释放 LangChain 侧 MCP Runtime（幂等）。
- 日志：开发模式（存在 `VITE_DEV_SERVER_URL`）下输出详细连接日志与超时原因；生产模式仅最小化日志。

## mcp.json 示例（唯一支持的格式）

```json
{
  "mcpServers": {
    "context7": {\n      "type": "http",\n      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "ctx7sk-..."
      }
    }
  }
}
```

> 注意：当 HTTP 服务端返回 4xx（例如不支持 Streamable HTTP）时，客户端会自动回退到 SSE 以保持兼容。

## 类型与实现约束（v1.18.0）

- 传输联合类型：`AnyTransport = StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport`。
- HTTP 重连参数：仅当 `maxReconnectionDelay`、`initialReconnectionDelay`、`reconnectionDelayGrowFactor`、`maxRetries` 四个字段全部提供时才生效；否则使用 SDK 默认值。
- SSE 头部：由于 `EventSourceInit` 无 `headers` 字段，所有头部通过 `requestInit.headers` 传递。
- `SdkMcpClient.initialize()` 返回结构：
  - `protocolVersion` 从底层传输按存在性读取（并非 SDK API 的一部分，可能为 `undefined`）。
  - `capabilities` 与 `serverInfo` 均直接来源于 SDK 的 `getServerCapabilities()` 与 `getServerVersion()`。

## Demo CLI（最小实现）

- 运行（默认读取 apps/desktop/mcp.json）：

`
npm run mcp:demo --workspace=@mindforge/desktop -- --config apps/desktop/mcp.json
`

- 仅连接指定 server：

`
npm run mcp:demo --workspace=@mindforge/desktop -- --config apps/desktop/mcp.json --id context7
`

- 类型检查（仅限 mcp 目录，忽略 LLM 相关类型复杂度）：

`
npm run check:mcp --workspace=@mindforge/desktop
`

> 脚本基于现有 McpSessionManager，按顺序执行 start → initialize → listTools，并在 stdout 输出连接状态、工具名称及摘要。

