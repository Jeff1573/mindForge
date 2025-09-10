// 非阻塞自检脚本：启动 Fastify 到随机端口，探测 /health 后关闭
import { buildApp } from '../src/app';

async function main() {
  const app = buildApp();
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  try {
    const url = typeof address === 'string' ? address : `http://${address.address}:${address.port}`;
    const res = await fetch(`${url}/health`);
    if (!res.ok) throw new Error(`health status ${res.status}`);
    const body = await res.json();
    console.log('[smoke] /health =>', body);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error('[smoke] failed:', e);
  process.exit(1);
});

