"use strict";

const path = require("node:path");
const http = require("node:http");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");

function configureDevelopmentEnvironment(env) {
  if (env.NODE_ENV === "production") throw new Error("Connected development cannot run in production.");
  const port = (value, fallback) => {
    const parsed = Number(value || fallback);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new Error("Use valid local PORT and API_PORT values.");
    return String(parsed);
  };
  const webPort = port(env.PORT, 3000);
  const apiPort = port(env.API_PORT, 4000);
  if (webPort === apiPort) throw new Error("PORT and API_PORT must be different.");
  if (!env.DATABASE_URL?.trim()) throw new Error("Configure DATABASE_URL and any required DATABASE_SSL_CA privately in .env.local before starting.");
  env.NODE_ENV = "development";
  env.PORT = webPort;
  env.API_PORT = apiPort;
  // Always connect the two local servers, regardless of production URL settings.
  env.APP_URL = `http://localhost:${webPort},http://127.0.0.1:${webPort}`;
  env.CRM_API_URL = `http://127.0.0.1:${apiPort}`;
  env.SITE_URL = `http://localhost:${webPort}`;
  env.NEXT_PUBLIC_API_URL = "";
  env.COOKIE_SECURE = "false";
  env.COOKIE_DOMAIN = "";
  for (const key of ["CUSTOMER_BOOKINGS_INTERNAL_TOKEN", "JWT_SECRET", "JWT_REFRESH_SECRET"]) {
    env[key] ||= randomBytes(48).toString("hex");
  }
}

async function startConnectedDevelopment() {
  const root = path.resolve(__dirname, "..");
  process.chdir(root);
  require("@next/env").loadEnvConfig(root, true);
  require("../backend/node_modules/dotenv").config({ path: path.join(root, "backend", ".env") });
  configureDevelopmentEnvironment(process.env);
  const build = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "apps/api/tsconfig.json"], {
    cwd: path.join(root, "backend"), stdio: "inherit",
  });
  if (build.error || build.status !== 0) throw new Error("The local API build failed.");
  const { createNestApp } = require("../backend/apps/api/dist/create-app.js");
  const api = await createNestApp();
  let next, server;
  const close = async () => {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await Promise.allSettled([api.close(), next?.close()]);
  };
  try {
    await api.listen(Number(process.env.API_PORT), "127.0.0.1");
    next = require("next")({ dev: true, dir: root, hostname: "localhost", port: Number(process.env.PORT) });
    await next.prepare();
    server = http.createServer(next.getRequestHandler());
    server.on("upgrade", next.getUpgradeHandler());
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(Number(process.env.PORT), "127.0.0.1", resolve);
    });
    console.log(`Connected website: http://localhost:${process.env.PORT}`);
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void close().finally(() => process.exit()); });
  } catch (error) {
    await close();
    throw error;
  }
}

if (require.main === module) {
  startConnectedDevelopment().catch(() => {
    // Startup errors may contain provider URLs; never echo them to the terminal.
    console.error("Connected development failed. Check private database/TLS settings, distinct local ports, and the API build.");
    process.exitCode = 1;
  });
}
module.exports = { configureDevelopmentEnvironment };
