"use strict";

const fs = require("node:fs");
const path = require("node:path");

function packageHostinger(root, distDir = process.env.NEXT_DIST_DIR || ".next") {
  const output = path.join(root, distDir, "standalone");
  const required = [`${distDir}/standalone/server.js`, `${distDir}/required-server-files.json`, "backend/apps/api/dist/create-app.js"];
  for (const file of required) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing build artifact: ${file}`);
  }
  // Hostinger publishes standalone/server.js, not package.json's start command.
  // Package both servers and their runtime dependencies into that same artifact.
  const safe = (source) => {
    const name = path.basename(source);
    return !name.startsWith(".env") && !/\.(sqlite|dump|pem|key)$/i.test(name);
  };
  const copy = (from, to = from) => fs.cpSync(path.join(root, from), path.join(output, to), {
    recursive: true, dereference: true, filter: safe,
  });
  copy("backend/apps/api/dist");
  copy("backend/scripts/hostinger-start.cjs");
  copy("backend/scripts/hostinger-api-path.cjs");
  copy("backend/packages/config");
  copy("backend/node_modules");
  if (fs.existsSync(path.join(root, "public"))) copy("public");
  copy(`${distDir}/static`);
  // Keep Next's serialized configuration, including route and tracing settings.
  const config = JSON.parse(fs.readFileSync(path.join(root, distDir, "required-server-files.json"), "utf8")).config;
  fs.writeFileSync(path.join(output, "server.js"), [
    '"use strict";',
    'process.env.NODE_ENV = "production";',
    'process.env.HOSTINGER_WEB_DIR = __dirname;',
    `process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(${JSON.stringify(config)});`,
    'require("./backend/scripts/hostinger-start.cjs");',
    "",
  ].join("\n"));
  console.log("Hostinger artifact contains the website and API; no migration or seed is run.");
}

if (require.main === module) packageHostinger(path.resolve(__dirname, ".."));
module.exports = { packageHostinger };
