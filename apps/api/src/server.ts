// CLI 启动入口（保留长驻，用于本地开发）；构造逻辑移至 app.ts 供 smoke 测试使用
import { getEnv, logger } from '@mindforge/shared';
import { buildApp } from './app';

const PORT = Number(process.env.PORT || 4000);

async function start() {
  const env = getEnv();
  const app = buildApp();
  logger.info('启动 API，环境：', env.NODE_ENV, '| AI_PROVIDER:', env.AI_PROVIDER);
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`API 已启动：http://localhost:${PORT}`);
  } catch (err) {
    logger.error('API 启动失败', err);
    process.exit(1);
  }
}

start();
