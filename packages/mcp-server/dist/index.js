// src/index.ts
function start() {
  console.log("[mcp-server] \u5360\u4F4D\u670D\u52A1\u5DF2\u542F\u52A8\uFF08\u5C1A\u672A\u5B9E\u73B0\u534F\u8BAE\u4E0E\u8DEF\u7531\uFF09");
}
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
export {
  start
};
