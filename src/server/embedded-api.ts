import "server-only";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";

type NestHttpServer = {
  address(): AddressInfo | string | null;
};

type NestApplication = {
  close(): Promise<void>;
  getHttpServer(): NestHttpServer;
  listen(port: number, host: string): Promise<unknown>;
};

type ApiModule = {
  createNestApp(): Promise<NestApplication>;
};

let startup: Promise<void> | undefined;

export function startEmbeddedApi(): Promise<void> {
  startup ??= start();
  return startup;
}

async function start() {
  const root = process.cwd();
  const apiPath = resolve(root, "backend/apps/api/dist/create-app.js");
  const { createNestApp } = (await import(
    /* webpackIgnore: true */ pathToFileURL(apiPath).href
  )) as ApiModule;
  const app = await createNestApp();

  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string") {
    await app.close();
    throw new Error("The embedded API did not bind to a loopback TCP port.");
  }

  process.env.ZAT_INTERNAL_API_ORIGIN = `http://127.0.0.1:${address.port}`;
  console.log("Embedded Nest API is ready on loopback.");
}
