"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { configureDevelopmentEnvironment } = require("./dev-connected.cjs");

test("connected development keeps frontend calls and cookies local", () => {
  const env = { DATABASE_URL: "postgresql://localhost/test", PORT: "3100", API_PORT: "4100", CRM_API_URL: "https://production.example", COOKIE_SECURE: "true", COOKIE_DOMAIN: ".example.com" };
  configureDevelopmentEnvironment(env);
  assert.equal(env.CRM_API_URL, "http://127.0.0.1:4100");
  assert.equal(env.APP_URL, "http://localhost:3100,http://127.0.0.1:3100");
  assert.equal(env.SITE_URL, "http://localhost:3100");
  assert.equal(env.NEXT_PUBLIC_API_URL, "");
  assert.equal(env.COOKIE_SECURE, "false");
  assert.equal(env.COOKIE_DOMAIN, "");
  assert.ok(env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN.length >= 32);
  assert.notEqual(env.JWT_SECRET, env.JWT_REFRESH_SECRET);
  const jwt = env.JWT_SECRET;
  configureDevelopmentEnvironment(env);
  assert.equal(env.JWT_SECRET, jwt);
});

test("invalid configuration fails before starting a server", () => {
  assert.throws(() => configureDevelopmentEnvironment({ NODE_ENV: "production" }), /cannot run in production/);
  assert.throws(() => configureDevelopmentEnvironment({}), /Configure DATABASE_URL/);
  assert.throws(() => configureDevelopmentEnvironment({ PORT: "3000", API_PORT: "3000" }), /must be different/);
  assert.throws(() => configureDevelopmentEnvironment({ PORT: "-1" }), /valid local/);
});
