import { createNestApp } from "./create-app";

function listenHost(raw?: string) {
  const h = (raw ?? "").trim();
  if (!h || /^https?:\/\//i.test(h) || h.includes("/") || h.includes(":")) {
    return "127.0.0.1";
  }
  return h;
}

async function bootstrap() {
  const app = await createNestApp();
  const port = Number(process.env.API_PORT ?? 4000);
  const host = listenHost(process.env.API_HOST);
  await app.listen(port, host);
  console.log(`ZAT API listening on ${host}:${port}`);
}

if (require.main === module) {
  bootstrap();
}
