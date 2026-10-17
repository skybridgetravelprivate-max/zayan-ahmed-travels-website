import assert from "node:assert/strict";
import { test } from "node:test";
import { linkWebsiteCustomerToCrm } from "./crm-link";

test("an unverified email never automatically links a CRM identity", async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("must not call"); };
  try {
    assert.equal(await linkWebsiteCustomerToCrm({ websiteCustomerId: "new-account", email: "existing@example.test", displayName: "Unverified" }), null);
    assert.equal(called, false);
  } finally { globalThis.fetch = original; }
});
