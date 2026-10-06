import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isApiPathname } = require("./hostinger-api-path.cjs");

assert.equal(isApiPathname("/api"), true);
assert.equal(isApiPathname("/api/auth/login"), true);
assert.equal(isApiPathname("/api/v1/leads"), true);
assert.equal(isApiPathname("/api/public/company"), true);
assert.equal(isApiPathname("/v1/customer/bookings"), true);
assert.equal(isApiPathname("/v1/customer/bookings?website_customer_id=x"), true);
assert.equal(isApiPathname("/v1/customer/upsert-by-email"), true);
assert.equal(isApiPathname("/v1/customers"), false);
assert.equal(isApiPathname("/v1"), false);
assert.equal(isApiPathname("/dashboard"), false);
assert.equal(isApiPathname("/"), false);

console.log("hostinger api path OK");
