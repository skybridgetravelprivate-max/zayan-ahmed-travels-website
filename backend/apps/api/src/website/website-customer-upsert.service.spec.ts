import assert from "node:assert/strict";
import { normalizeWebsiteCustomerEmail } from "./website-customer-upsert.service";

describe("normalizeWebsiteCustomerEmail", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeWebsiteCustomerEmail("  Ada@Example.COM "), "ada@example.com");
  });
});
