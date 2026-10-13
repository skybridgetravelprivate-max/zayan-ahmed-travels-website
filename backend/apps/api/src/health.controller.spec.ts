import assert from "node:assert/strict";
import { test } from "node:test";
import { HealthController } from "./health.controller";
import type { PrismaService } from "./common/prisma.service";
import type { Response } from "express";

test("health responds unavailable when the database ping fails", async () => {
  const controller = new HealthController({
    ping: async () => {
      throw new Error("database unavailable");
    },
  } as PrismaService);
  let responseStatus = 200;
  const response = {
    status(status: number) {
      responseStatus = status;
      return this;
    },
  } as Response;

  const result = await controller.health(response);

  assert.equal(responseStatus, 503);
  assert.equal(result.ok, false);
  assert.equal(result.db, false);
});

test("health responds successfully when the database ping succeeds", async () => {
  const controller = new HealthController({
    ping: async () => true,
  } as PrismaService);
  let responseStatus = 200;
  const response = {
    status(status: number) {
      responseStatus = status;
      return this;
    },
  } as Response;

  const result = await controller.health(response);

  assert.equal(responseStatus, 200);
  assert.equal(result.ok, true);
  assert.equal(result.db, true);
});
