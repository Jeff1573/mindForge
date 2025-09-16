// 通用 LLM 验证脚本：独立 Node.js 运行，依赖已编译的 Electron 主进程代码。
// 使用方式：
//   npm run build:electron --workspace=@mindforge/desktop
//   $env:AI_PROVIDER = "openai"; $env:AI_API_KEY = "......"
//   node apps/desktop/scripts/gemini-smoke.cjs "请用一句中文介绍 MindForge" "openai"
// 也可通过 LLM_SMOKE_PROMPT / LLM_SMOKE / AI_PROVIDER 环境变量控制默认值。

const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');

async function main() {
  try {
    dotenv.config({ path: path.resolve(__dirname, '../../..', '.env'), override: false });
    dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false });
  } catch {}

  const distMod = path.resolve(__dirname, '../dist/llm/smoke.js');
  if (!fs.existsSync(distMod)) {
    console.error('[llm-smoke] 未找到已编译模块：%s', distMod);
    console.error('请先执行：npm run build:electron --workspace=@mindforge/desktop');
    process.exitCode = 1;
    return;
  }

  const { runLLMSmoke } = require(distMod);
  if (typeof runLLMSmoke !== 'function') {
    console.error('[llm-smoke] 模块未导出 runLLMSmoke');
    process.exitCode = 1;
    return;
  }

  const [, , promptArg, providerArg] = process.argv;
  const prompt = promptArg || process.env.LLM_SMOKE_PROMPT;
  const provider = (providerArg || process.env.SMOKE_PROVIDER || process.env.AI_PROVIDER || 'gemini').toLowerCase();

  try {
    await runLLMSmoke({
      provider,
      prompt,
      force: true
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[llm-smoke] 失败：%s', message);
    process.exitCode = 1;
  }
}

main();
