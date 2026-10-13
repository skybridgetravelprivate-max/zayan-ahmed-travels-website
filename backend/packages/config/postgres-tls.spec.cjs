"use strict";

const assert = require("node:assert/strict");
const { rootCertificates } = require("node:tls");
const { test } = require("node:test");
const { createPostgresConnectionConfig } = require("./postgres-tls.cjs");

test("remote PostgreSQL enables certificate verification by default", () => {
  const config = createPostgresConnectionConfig("postgresql://user:pass@db.example.test:5432/app");

  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal("ca" in config.ssl, false);
});

test("custom CA is passed to the verified TLS connection", () => {
  const ca = rootCertificates[0];
  const config = createPostgresConnectionConfig("postgres://user:pass@db.example.test/app", ca);

  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, ca);
});

test("invalid CA configuration fails before creating a pool", () => {
  assert.throws(
    () => createPostgresConnectionConfig("postgres://user:pass@db.example.test/app", "not a certificate"),
    /DATABASE_SSL_CA must contain a valid PEM-encoded CA certificate/,
  );
  assert.throws(
    () => createPostgresConnectionConfig("postgres://user:pass@db.example.test/app", "  "),
    /DATABASE_SSL_CA must contain a PEM-encoded CA certificate/,
  );
});

test("connection URL cannot disable or bypass TLS verification", () => {
  const config = createPostgresConnectionConfig(
    "postgres://user:pass@db.example.test/app?sslmode=no-verify&sslrootcert=ignored.pem&schema=public",
  );

  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.connectionString.includes("sslmode"), false);
  assert.equal(config.connectionString.includes("sslrootcert"), false);
  assert.equal(config.connectionString.includes("schema=public"), true);
});

test("local PostgreSQL remains unencrypted while CA input is still validated", () => {
  const config = createPostgresConnectionConfig("postgres://user:pass@localhost:5432/app");

  assert.equal(config.ssl, undefined);
});

test("IPv4 and IPv6 loopback PostgreSQL remain unencrypted", () => {
  for (const host of ["127.0.0.1", "[::1]"]) {
    const config = createPostgresConnectionConfig(`postgresql://user:pass@${host}:5432/app`);

    assert.equal(config.ssl, undefined, `${host} should not use TLS for local PostgreSQL`);
  }
});

test("invalid connection URL and protocol fail safely", () => {
  assert.throws(() => createPostgresConnectionConfig("not a URL"), /valid PostgreSQL connection URL/);
  assert.throws(() => createPostgresConnectionConfig("mysql://db.example.test/app"), /must use the PostgreSQL protocol/);
});
