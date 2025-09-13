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

## mcp.json 示例（唯一支持的格式）

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "ctx7sk-..."
      }
    }
  }
}
```

> 注意：当 HTTP 服务端返回 4xx（例如不支持 Streamable HTTP）时，客户端会自动回退到 SSE 以保持兼容。
