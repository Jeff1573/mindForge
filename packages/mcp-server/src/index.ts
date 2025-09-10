// MCP Server 占位：后续接入 Gemini/Qdrant/OpenAI 等
export function start() {
  console.log('[mcp-server] 占位服务已启动（尚未实现协议与路由）');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

