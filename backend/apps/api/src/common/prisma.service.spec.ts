import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeDbError } from "./prisma.service";

test("sanitizeDbError redacts PostgreSQL credentials for both URL schemes", () => {
  for (const scheme of ["postgres", "postgresql"]) {
    const message = `${scheme}://private-user:private-password@db.example.test:5432/travel`;
    const sanitized = sanitizeDbError(new Error(message));

    assert.equal(sanitized.includes("private-user"), false);
    assert.equal(sanitized.includes("private-password"), false);
    assert.ok(sanitized.includes(`${scheme}://***@db.example.test`));
  }
});
