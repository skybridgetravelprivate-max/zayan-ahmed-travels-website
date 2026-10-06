"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { parse } = require("url");

const root = path.join(__dirname, "..");
loadEnvTree(root);
if (
  (!process.env.DATABASE_URL || /@HOST[:/]/i.test(process.env.DATABASE_URL)) &&
  (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL)
) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL;
}
syncPrismaEnv();

process.env.ZAT_GATEWAY = "1";
const mode = process.env.START_MODE || "all";
const publicPort = Number(process.env.PORT || process.env.WEB_PORT || 3000);
process.env.API_URL = process.env.API_URL || `http://127.0.0.1:${publicPort}`;

console.log(
  "DATABASE_URL present:",
  Boolean(process.env.DATABASE_URL),
  "| JWT_SECRET present:",
  Boolean(process.env.JWT_SECRET),
);

let nextHandle = null;
let nextUpgrade = null;
let apiExpress = null;

function loadDotEnv(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

function loadEnvTree(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    loadDotEnv(path.join(dir, ".env"));
    loadDotEnv(path.join(dir, ".env.production"));
    loadDotEnv(path.join(dir, "nodejs", ".env"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  loadDotEnv(path.join(start, "apps", "api", ".env"));
  loadDotEnv(path.join(start, "packages", "database", ".env"));
  loadDotEnv(path.join(start, "packages", "database", "prisma", ".env"));
}

function syncPrismaEnv() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const line = `DATABASE_URL=${JSON.stringify(url)}\n`;
  for (const d of [
    path.join(root, "packages", "database"),
    path.join(root, "packages", "database", "prisma"),
    path.join(root, "apps", "api"),
  ]) {
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, ".env"), line, { mode: 0o600 });
    } catch (err) {
      console.warn("Could not write Prisma .env in", d, err.message);
    }
  }
}

function requestPathname(req) {
  const raw = req.url || req.originalUrl || "";
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).pathname;
  } catch {
    /* ignore */
  }
  return String(raw).split("?")[0];
}

const { isApiPathname } = require("./hostinger-api-path.cjs");

function isApiPath(req) {
  const pathOnly = typeof req === "string" ? req.split("?")[0] : requestPathname(req);
  return isApiPathname(pathOnly);
}

function listenGateway() {
  const server = http.createServer((req, res) => {
    if (isApiPath(req)) {
      if (apiExpress) {
        apiExpress(req, res);
        return;
      }
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, message: "API is starting. Try again in a few seconds." }));
      return;
    }
    if (nextHandle) {
      nextHandle(req, res, parse(req.url, true));
      return;
    }
    res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, message: "Web is starting." }));
  });
  server.on("upgrade", (req, socket, head) => {
    if (isApiPath(req)) {
      socket.destroy();
      return;
    }
    if (nextUpgrade) {
      nextUpgrade(req, socket, head);
      return;
    }
    socket.destroy();
  });
  server.listen(publicPort, "0.0.0.0", () => {
    console.log(`ZAT gateway listening on 0.0.0.0:${publicPort} (Next + API in one process)`);
  });
}

async function embedApi() {
  const dist = path.join(root, "apps", "api", "dist", "create-app.js");
  if (!fs.existsSync(dist)) {
    console.error("API build missing:", dist);
    return;
  }
  require("reflect-metadata");
  const { createNestApp } = require(dist);
  const nestApp = await createNestApp();
  apiExpress = nestApp.getHttpAdapter().getInstance();
  console.log("ZAT API ready (embedded, no extra port)");
}

async function prepareNext() {
  let nextFactory;
  try {
    nextFactory = require("next");
  } catch {
    nextFactory = require(path.join(root, "apps", "web", "node_modules", "next"));
  }
  const nxt = nextFactory({
    dev: false,
    dir: path.join(root, "apps", "web"),
    hostname: "0.0.0.0",
    port: publicPort,
  });
  await nxt.prepare();
  nextHandle = nxt.getRequestHandler();
  if (typeof nxt.getUpgradeHandler === "function") {
    nextUpgrade = nxt.getUpgradeHandler();
  }
  console.log("Next.js is ready (in-process)");
}

async function main() {
  listenGateway();
  if (mode === "api" || mode === "all") {
    try {
      await embedApi();
    } catch (err) {
      console.error("Failed to embed API:", err);
    }
  }
  if (mode === "web" || mode === "all") await prepareNext();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
