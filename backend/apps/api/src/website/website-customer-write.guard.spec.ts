import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { WebsiteCustomerWriteGuard } from "./website-customer-write.guard";

test("website customer writes are enabled outside production unless explicitly paused", () => {
  const priorNodeEnv = process.env.NODE_ENV;
  const priorWrites = process.env.CUSTOMER_WRITES_ENABLED;
  try {
    delete process.env.NODE_ENV;
    delete process.env.CUSTOMER_WRITES_ENABLED;
    assert.equal(new WebsiteCustomerWriteGuard().canActivate(), true);

    process.env.NODE_ENV = "production";
    assert.throws(
      () => new WebsiteCustomerWriteGuard().canActivate(),
      (error: unknown) => error instanceof ServiceUnavailableException && error.getStatus() === 503,
    );

    process.env.CUSTOMER_WRITES_ENABLED = "true";
    assert.equal(new WebsiteCustomerWriteGuard().canActivate(), true);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    if (priorWrites === undefined) delete process.env.CUSTOMER_WRITES_ENABLED;
    else process.env.CUSTOMER_WRITES_ENABLED = priorWrites;
  }
});
