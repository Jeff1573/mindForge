# 说明

此目录提供无 MCP 依赖的 ReAct Agent 构建逻辑（LangGraph prebuilt `createReactAgent`）。
默认仅注入空工具集（`tools: []`）。如需 MCP，请在上层应用自行扩展，不在本包内提供依赖。

