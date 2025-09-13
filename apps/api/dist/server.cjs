"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server.ts
var import_shared2 = require("@mindforge/shared");

// src/app.ts
var import_fastify = __toESM(require("fastify"), 1);
var import_shared = require("@mindforge/shared");
function buildApp() {
  const app = (0, import_fastify.default)({ logger: false });
  app.get("/health", async () => ({ status: "ok", ts: Date.now() }));
  app.get("/env", async () => (0, import_shared.getPublicEnv)());
  return app;
}

// src/server.ts
var PORT = Number(process.env.PORT || 4e3);
async function start() {
  const env = (0, import_shared2.getEnv)();
  const app = buildApp();
  import_shared2.logger.info("\u542F\u52A8 API\uFF0C\u73AF\u5883\uFF1A", env.NODE_ENV, "| AI_PROVIDER:", env.AI_PROVIDER);
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    import_shared2.logger.info(`API \u5DF2\u542F\u52A8\uFF1Ahttp://localhost:${PORT}`);
  } catch (err) {
    import_shared2.logger.error("API \u542F\u52A8\u5931\u8D25", err);
    process.exit(1);
  }
}
start();
