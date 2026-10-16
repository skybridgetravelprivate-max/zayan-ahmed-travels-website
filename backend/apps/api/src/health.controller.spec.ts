import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

test("health is ready only when PostgreSQL responds", async () => {
  const controller = new HealthController({ ping: async () => {} });
  const health = await controller.health();

  assert.equal(health.ok, true);
  assert.equal(health.db, true);
  assert.equal(health.dbConfigured, true);
  assert.equal(health.service, "zat-api");
});

test("health returns 503 when PostgreSQL is unavailable", async () => {
  const controller = new HealthController({
    ping: async () => {
      throw new Error("connection refused");
    },
  });
  const originalError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(controller.health(), (error: unknown) => {
      return error instanceof ServiceUnavailableException && error.getStatus() === 503;
    });
  } finally {
    console.error = originalError;
  }
});
