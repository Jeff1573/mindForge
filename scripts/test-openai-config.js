#!/usr/bin/env node
// 说明：OpenAI（兼容）配置解析与连通性测试脚本
// - 读取环境变量并按桌面端 openai provider 一致的优先级解析；
// - 支持 --dry-run（仅解析不触网）、--verbose（输出更多细节）；
// - 默认依次尝试 /v1/chat/completions 与 /v1/models，任一成功即判定“连通”；
// - 不引入额外依赖，直接使用 Node.js 内置 fetch。

// 自动加载 .env（可选）
require('dotenv/config');

// ---------------------------
// 参数解析
// ---------------------------
const args = process.argv.slice(2);
const argv = new Set(args);
const isDryRun = argv.has('--dry-run');
const isVerbose = argv.has('--verbose');
const chatOnly = argv.has('--chat-only');
const modelsOnly = argv.has('--models-only');

// ---------------------------
// 工具函数
// ---------------------------
/** 打码 API Key：保留前 6 后 4 位 */
function maskKey(key) {
  if (!key) return '(未设置)';
  const s = String(key);
  if (s.length <= 10) return s.replace(/.(?=.{2})/g, '*');
  return s.slice(0, 6) + '*'.repeat(Math.max(0, s.length - 10)) + s.slice(-4);
}

/** 判定字符串是否看起来是完整的 /v1 Base URL */
function looksLikeV1BaseURL(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /\/v\d+\/?$/.test(u.pathname);
  } catch (_) {
    return false;
  }
}

/** 简单的超时包装 */
async function withTimeout(promise, ms, label = 'request') {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await promise(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** 将 Response 尝试解析为 JSON（失败则返回文本） */
async function parseResponseBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------
// 一致性校验（桌面端 provider 与共享 env 定义）
// - 检查 packages/shared/src/env.{ts,js} 是否包含 OPENAI_BASE_URL/OPENAI_MODEL 定义；
// - 校验 apps/desktop/electron/llm/providers/openai.ts 与 graphs/reactAgent.ts 的优先级与默认模型；
// ---------------------------
async function checkDesktopConsistency() {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '..');
  const files = {
    envTs: path.join(root, 'packages/shared/src/env.ts'),
    envJs: path.join(root, 'packages/shared/src/env.js'),
    providerOpenAI: path.join(root, 'apps/desktop/electron/llm/providers/openai.ts'),
    reactAgent: path.join(root, 'apps/desktop/electron/llm/graphs/reactAgent.ts'),
  };

  function safeRead(p) {
    try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
  }

  const envTs = safeRead(files.envTs) || '';
  const envJs = safeRead(files.envJs) || '';
  const openaiTs = safeRead(files.providerOpenAI) || '';
  const reactAgentTs = safeRead(files.reactAgent) || '';

  const report = [];

  // shared/env: 关键字段存在性
  const tsHasOpenAIBase = /OPENAI_BASE_URL/.test(envTs);
  const tsHasOpenAIModel = /OPENAI_MODEL/.test(envTs);
  const jsHasOpenAIBase = /OPENAI_BASE_URL/.test(envJs);
  const jsHasOpenAIModel = /OPENAI_MODEL/.test(envJs);
  if (tsHasOpenAIBase && tsHasOpenAIModel) {
    report.push('[shared/env.ts] OK: 包含 OPENAI_BASE_URL / OPENAI_MODEL');
  } else {
    report.push('[shared/env.ts] 缺少 OPENAI_BASE_URL/OPENAI_MODEL 定义（请检查 env.ts）');
  }
  if (!envJs) {
    report.push('[shared/env.js] 未找到（可能由构建产物生成，若运行时走 TS 编译可忽略）。');
  } else if (jsHasOpenAIBase && jsHasOpenAIModel) {
    report.push('[shared/env.js] OK: 包含 OPENAI_BASE_URL / OPENAI_MODEL');
  } else {
    report.push('[shared/env.js] 注意：未检测到 OPENAI_BASE_URL/OPENAI_MODEL，可能为过期构建产物。建议重新构建 shared 包。');
  }

  // provider 优先级与默认模型
  const openaiModelPriorityOk = /init\.model\s*\?\?\s*env\.OPENAI_MODEL\s*\?\?\s*env\.AI_MODEL/.test(openaiTs);
  const openaiKeyPriorityOk = /init\.apiKey\s*\?\?\s*env\.OPENAI_API_KEY\s*\?\?\s*env\.AI_API_KEY/.test(openaiTs);
  const openaiBasePriorityOk = /init\.baseURL\s*\?\?\s*env\.OPENAI_BASE_URL\s*\?\?\s*env\.AI_BASE_URL/.test(openaiTs);
  const openaiDefaultModel = (openaiTs.match(/const\s+DEFAULT_MODEL\s*=\s*['"]([^'"]+)['"]/)
    || [null, null])[1];

  const reactModelPriorityOk = /env\.OPENAI_MODEL\s*\?\?\s*env\.AI_MODEL/.test(reactAgentTs) && /provider\s*===\s*['"]openai['"]/.test(reactAgentTs);
  const reactKeyPriorityOk = /env\.OPENAI_API_KEY\s*\?\?\s*env\.AI_API_KEY/.test(reactAgentTs);
  const reactBasePriorityOk = /env\.OPENAI_BASE_URL\s*\?\?\s*env\.AI_BASE_URL/.test(reactAgentTs);
  const reactDefaultModel = (reactAgentTs.match(/model:\s*modelName\s*\|\|\s*['"]([^'"]+)['"]/)
    || [null, null])[1];

  report.push(openaiModelPriorityOk
    ? '[desktop/providers/openai.ts] OK: 模型优先级 init.model > OPENAI_MODEL > AI_MODEL'
    : '[desktop/providers/openai.ts] 异常：未匹配到模型优先级（请核对实现）');
  report.push(openaiKeyPriorityOk
    ? '[desktop/providers/openai.ts] OK: 密钥优先级 init.apiKey > OPENAI_API_KEY > AI_API_KEY'
    : '[desktop/providers/openai.ts] 异常：未匹配到密钥优先级');
  report.push(openaiBasePriorityOk
    ? '[desktop/providers/openai.ts] OK: baseURL 优先级 init.baseURL > OPENAI_BASE_URL > AI_BASE_URL'
    : '[desktop/providers/openai.ts] 异常：未匹配到 baseURL 优先级');

  if (openaiDefaultModel) {
    if (openaiDefaultModel === DEFAULT_OPENAI_MODEL) {
      report.push(`[desktop/providers/openai.ts] OK: 默认模型一致 (${openaiDefaultModel})`);
    } else {
      report.push(`[desktop/providers/openai.ts] 注意：默认模型为 ${openaiDefaultModel}，与脚本常量 ${DEFAULT_OPENAI_MODEL} 不一致`);
    }
  }

  report.push(reactModelPriorityOk
    ? '[desktop/graphs/reactAgent.ts] OK: 模型优先级 OPENAI_MODEL > AI_MODEL（仅 openai 分支）'
    : '[desktop/graphs/reactAgent.ts] 异常：未匹配到模型优先级');
  report.push(reactKeyPriorityOk
    ? '[desktop/graphs/reactAgent.ts] OK: 密钥优先级 OPENAI_API_KEY > AI_API_KEY'
    : '[desktop/graphs/reactAgent.ts] 异常：未匹配到密钥优先级');
  report.push(reactBasePriorityOk
    ? '[desktop/graphs/reactAgent.ts] OK: baseURL 优先级 OPENAI_BASE_URL > AI_BASE_URL'
    : '[desktop/graphs/reactAgent.ts] 异常：未匹配到 baseURL 优先级');
  if (reactDefaultModel) {
    if (reactDefaultModel === DEFAULT_OPENAI_MODEL) {
      report.push(`[desktop/graphs/reactAgent.ts] OK: 默认模型一致 (${reactDefaultModel})`);
    } else {
      report.push(`[desktop/graphs/reactAgent.ts] 注意：默认模型为 ${reactDefaultModel}，与脚本常量 ${DEFAULT_OPENAI_MODEL} 不一致`);
    }
  }

  console.log('\n=== 桌面 provider 一致性检查（静态） ===');
  for (const line of report) console.log('- ' + line);
}

// ---------------------------
// 配置解析（与桌面 provider 逻辑保持一致）
// - provider: AI_PROVIDER
// - model: OPENAI_MODEL > AI_MODEL > 默认 gpt-40-mini（仅 openai 分支）
// - apiKey: OPENAI_API_KEY > AI_API_KEY
// - baseURL: OPENAI_BASE_URL > AI_BASE_URL（需包含 /v1 前缀）
// ---------------------------
const DEFAULT_OPENAI_MODEL = 'gpt-40-mini';

function resolveEffectiveConfig() {
  const env = process.env;
  const provider = (env.AI_PROVIDER || 'gemini').trim();
  const model = (env.OPENAI_MODEL || env.AI_MODEL || (provider === 'openai' ? DEFAULT_OPENAI_MODEL : '') || '').trim();
  const apiKey = (env.OPENAI_API_KEY || env.AI_API_KEY || '').trim();
  const baseURLRaw = (env.OPENAI_BASE_URL || env.AI_BASE_URL || '').trim();
  const baseURL = baseURLRaw || 'https://api.openai.com/v1';

  const sources = {
    provider: 'AI_PROVIDER',
    model: env.OPENAI_MODEL ? 'OPENAI_MODEL' : (env.AI_MODEL ? 'AI_MODEL' : (provider === 'openai' ? '(默认值)' : '(未定义)')),
    apiKey: env.OPENAI_API_KEY ? 'OPENAI_API_KEY' : (env.AI_API_KEY ? 'AI_API_KEY' : '(未定义)'),
    baseURL: env.OPENAI_BASE_URL ? 'OPENAI_BASE_URL' : (env.AI_BASE_URL ? 'AI_BASE_URL' : '(默认：https://api.openai.com/v1)')
  };

  return { provider, model, apiKey, baseURL, sources };
}

function printConfig(config) {
  const { provider, model, apiKey, baseURL, sources } = config;
  console.log('=== OpenAI 配置解析（与桌面 provider 规则一致）===');
  console.log(`provider: ${provider}  [${sources.provider}]`);
  console.log(`model: ${model || '(未设置)' }  [${sources.model}]`);
  console.log(`apiKey: ${maskKey(apiKey)}  [${sources.apiKey}]`);
  console.log(`baseURL: ${baseURL}  [${sources.baseURL}]`);
  if (!looksLikeV1BaseURL(baseURL)) {
    console.warn('! 警告：baseURL 末尾似乎不包含 /v1（或版本前缀），兼容服务通常要求包含，例如 https://your-domain/v1');
  }
  if (provider !== 'openai') {
    console.warn(`! 提示：AI_PROVIDER=${provider}，但本测试将按 OpenAI 兼容接口进行连通性校验。`);
  }
}

// ---------------------------
// 连通性测试：/v1/chat/completions
// ---------------------------
async function testChatCompletion({ baseURL, apiKey, model }) {
  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    temperature: 0,
    max_tokens: 16
  };
  const started = Date.now();
  try {
    const res = await withTimeout((signal) => fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    }), 15000, 'chat');

    const ms = Date.now() - started;
    const body = await parseResponseBody(res);
    if (res.ok) {
      // 尝试取出首条回复片段
      let snippet = '';
      try {
        snippet = body.choices?.[0]?.message?.content ?? JSON.stringify(body).slice(0, 120);
      } catch (_) {}
      return { ok: true, ms, url, body, snippet };
    }
    // 分类诊断
    const hint = classifyHttpError(res.status, body, url, 'chat');
    return { ok: false, ms, url, body, hint };
  } catch (err) {
    return { ok: false, url, err, hint: classifyNetworkError(err, url) };
  }
}

// ---------------------------
// 连通性测试：/v1/models
// ---------------------------
async function testModels({ baseURL, apiKey }) {
  const url = `${baseURL.replace(/\/+$/, '')}/models`;
  const started = Date.now();
  try {
    const res = await withTimeout((signal) => fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      signal
    }), 15000, 'models');

    const ms = Date.now() - started;
    const body = await parseResponseBody(res);
    if (res.ok) {
      const count = Array.isArray(body?.data) ? body.data.length : (Array.isArray(body?.models) ? body.models.length : 0);
      return { ok: true, ms, url, body, count };
    }
    const hint = classifyHttpError(res.status, body, url, 'models');
    return { ok: false, ms, url, body, hint };
  } catch (err) {
    return { ok: false, url, err, hint: classifyNetworkError(err, url) };
  }
}

// ---------------------------
// 诊断与提示
// ---------------------------
function classifyHttpError(status, body, url, kind) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  if (status === 401 || status === 403) {
    return `鉴权失败（${status}）。请检查 API Key 与权限；URL=${url}`;
  }
  if (status === 404) {
    return `接口不存在（${status}）。如果你的自定义网关兼容 OpenAI，请确认 baseURL 是否包含 /v1；URL=${url}`;
  }
  if (status === 400) {
    if (/model/i.test(bodyStr) && /(not\s*found|unknown|invalid)/i.test(bodyStr)) {
      return '模型名不可用或无权限，请确认 OPENAI_MODEL/AI_MODEL 是否为该网关支持的模型。';
    }
    return `请求参数错误（400）。响应：${bodyStr.slice(0, 300)}`;
  }
  return `HTTP ${status}。响应：${bodyStr.slice(0, 300)}`;
}

function classifyNetworkError(err, url) {
  const msg = String(err && err.message || err);
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|aborted/i.test(msg)) {
    return `网络/连接失败：${msg}（URL=${url}）。请检查地址、端口、证书与代理。`;
  }
  return `请求异常：${msg}（URL=${url}）`;
}

// ---------------------------
// 主流程
// ---------------------------
(async () => {
  const config = resolveEffectiveConfig();
  printConfig(config);

  if (isDryRun) {
    console.log('\n(dry-run) 仅展示配置解析结果，未发起网络请求。');
    process.exit(0);
    return;
  }

  if (!config.apiKey) {
    console.error('\n[错误] 未配置 OPENAI_API_KEY / AI_API_KEY，无法进行连通性测试。可使用 --dry-run 查看解析。');
    process.exit(2);
    return;
  }

  // 桌面 provider 一致性快速校验（静态扫描源码，发现潜在不一致）
  await checkDesktopConsistency();

  const results = [];
  if (!modelsOnly) {
    const r1 = await testChatCompletion(config);
    results.push({ kind: 'chat', ...r1 });
    if (isVerbose) {
      console.log('\n[chat] 详细结果：');
      console.log(JSON.stringify(r1, null, 2));
    }
    if (r1.ok) {
      console.log(`\n[通过] chat.completions OK（${r1.ms}ms），响应片段：${String(r1.snippet).slice(0, 120)}`);
    } else {
      console.warn(`\n[失败] chat.completions：${r1.hint || '未知错误'}`);
    }
  }

  if (!chatOnly) {
    const r2 = await testModels(config);
    results.push({ kind: 'models', ...r2 });
    if (isVerbose) {
      console.log('\n[models] 详细结果：');
      console.log(JSON.stringify(r2, null, 2));
    }
    if (r2.ok) {
      console.log(`\n[通过] models 列表 OK（${r2.ms}ms），条目数：${r2.count}`);
    } else {
      console.warn(`\n[失败] models：${r2.hint || '未知错误'}`);
    }
  }

  const anyOk = results.some(r => r.ok);
  if (anyOk) {
    console.log('\n=== 结论：自定义 OpenAI 配置“已生效并可用”（至少一个接口连通） ===');
    process.exit(0);
  } else {
    console.error('\n=== 结论：未能连通，请根据上方诊断检查 baseURL/model/API Key/网络 ===');
    process.exit(1);
  }
})();
