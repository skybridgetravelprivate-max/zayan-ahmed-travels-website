import assert from "node:assert/strict";
import test from "node:test";
import { AuthController } from "./auth.controller";

test("unconfigured recovery fails equally before looking up any email or creating tokens", async () => {
  const old = process.env.SMTP_HOST; delete process.env.SMTP_HOST;
  let touched = false;
  const controller = new AuthController({ user: { findUnique: async () => { touched = true; return null; } } } as never, {} as never, {} as never);
  try {
    await assert.rejects(controller.forgot({ email: "synthetic@example.test" }), (e: unknown) => (e as {getStatus(): number}).getStatus() === 503);
    assert.equal(touched, false);
  } finally { if (old !== undefined) process.env.SMTP_HOST = old; }
});
