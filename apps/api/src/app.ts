import Fastify from 'fastify';
import { getEnv, getPublicEnv } from '@mindforge/shared';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));
  app.get('/env', async () => getPublicEnv());

  return app;
}

