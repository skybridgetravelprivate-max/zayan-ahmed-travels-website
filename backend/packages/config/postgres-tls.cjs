"use strict";

const { createSecureContext } = require("node:tls");
const { X509Certificate } = require("node:crypto");

function createPostgresConnectionConfig(connectionString, caCertificate = process.env.DATABASE_SSL_CA) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  let ca;
  if (caCertificate !== undefined) {
    ca = caCertificate.replace(/\\n/g, "\n").trim();
    if (!ca) throw new Error("DATABASE_SSL_CA must contain a PEM-encoded CA certificate when set.");
    try {
      const certificates = [...ca.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)];
      const remaining = ca.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, "").trim();
      if (certificates.length === 0 || remaining) throw new Error("Invalid certificate bundle.");
      for (const certificate of certificates) {
        new X509Certificate(certificate[0]);
      }
      createSecureContext({ ca: certificates.map((certificate) => certificate[0]).join("\n") });
    } catch {
      throw new Error("DATABASE_SSL_CA must contain a valid PEM-encoded CA certificate.");
    }
  }

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("ssl") || key.toLowerCase() === "uselibpqcompat") {
      url.searchParams.delete(key);
    }
  }

  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  return {
    connectionString: url.toString(),
    ssl: isLocal ? undefined : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}

module.exports = { createPostgresConnectionConfig };
