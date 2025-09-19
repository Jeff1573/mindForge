/**
 * 文档：LLM 连通性自测脚本（可独立运行）
 *
 * 作用：
 * - 按当前环境变量与可选 CLI 入参，尝试向所选提供商发送最小消息，判断是否“可用”。
 * - 对 OpenAI 提供商，支持在失败时自动切换 Chat Completions/Responses API 进行二次探测，
 *   并给出推荐的 OPENAI_USE_RESPONSES_API 设置建议。
 *
 * 使用：
 * - npm run llm:test --workspace=@mindforge/desktop -- [-m "你好"] [--provider openai] [--model gpt-4o-mini]
 *   [--base-url http://.../v1] [--responses auto|true|false]
 *
 * 约束：
 * - 不新增任何依赖；仅使用项目内工厂方法创建模型。
 * - 输出仅做最小必要脱敏（API Key 末 4 位）。
 */

import { getReactAgent, getReactAgentWithoutMcp } from '../graphs/reactAgent';

async function main() {
  // 获取命令行参数
  const message = process.argv[2];
  console.log('message', message);

  if (message === "no-mcp"|| message === undefined) {
    const agent = await getReactAgentWithoutMcp();
    const res = await agent.invoke({
      messages: [{ role: 'user', content: "你好" }],
    });
    console.log(res);
  } else if (message === "mcp") {
    const agent = await getReactAgent();
    const res = await agent.invoke({
      messages: [{ role: 'user', content: "你好" }],
    });
    console.log(res);
  } else {
    console.log('请输入mcp或no-mcp');
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
