"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { parse } = require("url");

const root = path.join(__dirname, "..");
const repositoryRoot = path.join(root, "..");
const webRoot = process.env.HOSTINGER_WEB_DIR
  ? path.resolve(process.env.HOSTINGER_WEB_DIR)
  : fs.existsSync(path.join(repositoryRoot, "next.config.ts"))
    ? repositoryRoot
    : path.join(root, "apps", "web");
loadEnvTree(root);
if (
  (!process.env.DATABASE_URL || /@HOST[:/]/i.test(process.env.DATABASE_URL)) &&
  (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL)
) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL;
}

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

function requestPathname(req) {
  const raw = req.url || req.originalUrl || "";
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).pathname;
  } catch {
    /* ignore */
  }
  return String(raw).split("?")[0];
}

const { isApiPathname, receiptWriteBlocked } = require("./hostinger-api-path.cjs");

class MissingApiArtifactError extends Error {
  constructor(relativePath) {
    super(`Required API build artifact is missing: ${relativePath}`);
    this.name = "MissingApiArtifactError";
  }
}

function isApiPath(req) {
  const pathOnly = typeof req === "string" ? req.split("?")[0] : requestPathname(req);
  return isApiPathname(pathOnly);
}

function listenGateway() {
  const server = http.createServer((req, res) => {
    if (receiptWriteBlocked(req, process.env.RECEIPT_WRITES_DISABLED, process.env.BUSINESS_WRITES_DISABLED)) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "retry-after": "60" });
      res.end(JSON.stringify({ ok: false, message: "Receipt writes are temporarily unavailable. Preserve the original retry key and review saved receipts before retrying." }));
      return;
    }
    if (isApiPath(req)) {
      if (apiExpress) {
        apiExpress(req, res);
        return;
      }
      res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "3" });
      res.end(JSON.stringify({ ok: false, message: "API is starting. Try again in a few seconds." }));
      return;
    }
    if (nextHandle) {
      nextHandle(req, res, parse(req.url, true));
      return;
    }
    res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "3" });
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
  const host = process.env.GATEWAY_HOST || "0.0.0.0";
  if (!["127.0.0.1", "0.0.0.0"].includes(host)) throw new Error("Invalid gateway bind address");
  server.listen(publicPort, host, () => {
    console.log(`ZAT gateway listening on ${host}:${publicPort} (Next + API in one process)`);
  });
}

async function embedApi() {
  const dist = path.join(root, "apps", "api", "dist", "create-app.js");
  if (!fs.existsSync(dist)) {
    const relativePath = path.relative(root, dist).split(path.sep).join("/");
    throw new MissingApiArtifactError(relativePath);
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
    nextFactory = require(path.join(webRoot, "node_modules", "next"));
  }
  const nxt = nextFactory({
    dev: false,
    dir: webRoot,
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
  if (mode === "api" || mode === "all") {
    await embedApi();
  }
  if (mode === "web" || mode === "all") await prepareNext();
  listenGateway();
}

main().catch((err) => {
  const message =
    err instanceof MissingApiArtifactError
      ? err.message
      : "An unexpected error occurred.";
  console.error(`Hostinger startup failed: ${message}`);
  process.exit(1);
});
