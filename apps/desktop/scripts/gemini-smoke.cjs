// 临时脚本：独立用 Node.js 验证 Gemini 流式输出
// 运行前提：已执行 `npm run build:electron --workspace=@mindforge/desktop`
// 使用方式（PowerShell）：
//   $env:GOOGLE_API_KEY = "<你的Key>"
//   node apps/desktop/scripts/gemini-smoke.cjs "用一句中文介绍你自己"
// 或使用工作区脚本：
//   npm run smoke:gemini --workspace=@mindforge/desktop
//     （可通过 LLM_SMOKE_PROMPT 自定义提示）

const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');

async function main() {
  // 加载根目录与 apps/desktop 的 .env（后者不覆盖已有值）
  try {
    dotenv.config({ path: path.resolve(__dirname, '../../..', '.env'), override: false });
    dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false });
  } catch {}

  if (!process.env.GOOGLE_API_KEY) {
    console.error('[gemini-smoke] 缺少 GOOGLE_API_KEY 环境变量');
    process.exitCode = 1;
    return;
  }

  const distMod = path.resolve(__dirname, '../dist/llm/providers/gemini.js');
  if (!fs.existsSync(distMod)) {
    console.error('[gemini-smoke] 未找到已编译模块：%s', distMod);
    console.error('请先执行：npm run build:electron --workspace=@mindforge/desktop');
    process.exitCode = 1;
    return;
  }

  const { streamText, createGeminiModel } = require(distMod);
  const prompt = process.argv[2] || process.env.LLM_SMOKE_PROMPT || '请用一句中文介绍你自己，并控制在 30 字以内。';
  const mode = (process.argv[3] || process.env.SMOKE_MODE || '').toLowerCase();

  console.log('[gemini-smoke] 开始，model=gemini-2.5-flash, mode=%s', mode || 'stream');
  let acc = '';
  try {
    if (mode === 'events' || mode === '--events') {
      const model = await createGeminiModel();
      const eventStream = await model.streamEvents(prompt, { version: 'v2' });
      for await (const ev of eventStream) {
        if (ev && ev.event === 'on_chat_model_stream') {
          const chunk = ev.data && ev.data.chunk;
          let piece = '';
          if (chunk) {
            const content = chunk.content;
            if (typeof content === 'string') piece = content;
            else if (Array.isArray(content)) {
              piece = content.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('');
            } else if (content && typeof content === 'object' && 'text' in content) {
              piece = String(content.text || '');
            }
          }
          if (!piece && ev.data && ev.data.chunk && typeof ev.data.chunk.text === 'string') {
            piece = ev.data.chunk.text; // 某些驱动使用 text 字段携带增量
          }
          if (piece) {
            acc += piece;
            process.stdout.write(piece);
          }
        }
      }
    } else {
      const iter = await streamText(prompt);
      for await (const chunk of iter) {
        acc += chunk;
        process.stdout.write(chunk);
      }
    }
    console.log('\n[gemini-smoke] 完成，总长度=%d', acc.length);
  } catch (err) {
    const e = err || {};
    const message = e.message || String(err);
    console.error('\n[gemini-smoke] 失败：%s', message);
    if (e.response && e.response.status) console.error('[gemini-smoke] 状态码：%s', e.response.status);
    process.exitCode = 1;
  }
}

main();
