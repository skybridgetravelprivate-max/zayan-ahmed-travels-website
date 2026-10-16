import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeWebsiteCustomerEmail } from "./website-customer-upsert.service";

test("normalizeWebsiteCustomerEmail trims and lowercases", () => {
  assert.equal(normalizeWebsiteCustomerEmail("  Ada@Example.COM "), "ada@example.com");
});
