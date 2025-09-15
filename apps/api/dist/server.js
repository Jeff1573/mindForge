// src/server.ts
import { getEnv, logger } from "@mindforge/shared";

// src/app.ts
import Fastify from "fastify";
import { getPublicEnv } from "@mindforge/shared";
function buildApp() {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));
  app.get("/env", async () => getPublicEnv());
  return app;
}

// src/server.ts
var PORT = Number(process.env.PORT || 4e3);
async function start() {
  const env = getEnv();
  const app = buildApp();
  logger.info("\u542F\u52A8 API\uFF0C\u73AF\u5883\uFF1A", env.NODE_ENV, "| AI_PROVIDER:", env.AI_PROVIDER);
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`API \u5DF2\u542F\u52A8\uFF1Ahttp://localhost:${PORT}`);
  } catch (err) {
    logger.error("API \u542F\u52A8\u5931\u8D25", err);
    process.exit(1);
  }
}
start();
