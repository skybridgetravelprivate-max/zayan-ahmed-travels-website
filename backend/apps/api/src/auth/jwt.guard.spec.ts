import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "./jwt.guard";

test("staff tokens require a live unrevoked session belonging to the same user", async () => {
  const prior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "isolated-test-secret-not-used-for-real-tokens";
  const valid = { userId: "staff-id", revokedAt: null, expiresAt: new Date(Date.now() + 60000) };
  let session: typeof valid | null = valid;
  let payload = { sub: "staff-id", sid: "session-id" };
  let userReads = 0;
  const request = { cookies: { access_token: "test-token" }, headers: {}, user: undefined as unknown };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  const prisma = {
    session: { findUnique: async () => session },
    user: { findUnique: async () => { userReads++; return { id: "staff-id", status: "ACTIVE", roles: [], branches: [] }; } },
  } as unknown as PrismaService;
  const guard = new JwtAuthGuard({ verifyAsync: async () => payload } as unknown as JwtService, prisma);
  try {
    assert.equal(await guard.canActivate(context), true);
    assert.equal(userReads, 1);
    for (const value of [null, { ...valid, userId: "other-user" }, { ...valid, expiresAt: new Date(0) }, { ...valid, revokedAt: new Date() }]) {
      session = value as typeof valid | null;
      await assert.rejects(guard.canActivate(context), { status: 401 });
    }
    session = valid;
    payload = { sub: "staff-id", sid: undefined as unknown as string };
    await assert.rejects(guard.canActivate(context), { status: 401 });
    assert.equal(userReads, 1);
  } finally {
    if (prior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior;
  }
});
