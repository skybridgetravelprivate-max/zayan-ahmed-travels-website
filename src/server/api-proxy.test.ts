import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { embeddedApiOrigin, proxyApiRequest } from "@/server/api-proxy";

test("API proxy preserves method, path, query, body, cookies, and status", async () => {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    response.writeHead(201, {
      "Content-Type": "application/json",
      "Set-Cookie": ["first=one; Path=/; HttpOnly", "second=two; Path=/; Secure"],
    });
    response.end(
      JSON.stringify({
        method: request.method,
        url: request.url,
        cookie: request.headers.cookie,
        body: Buffer.concat(chunks).toString("utf8"),
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const previousOrigin = process.env.ZAT_INTERNAL_API_ORIGIN;
  process.env.ZAT_INTERNAL_API_ORIGIN = `http://127.0.0.1:${address.port}`;

  try {
    const response = await proxyApiRequest(
      new Request("https://site.example/api/v1/bookings?ref=smoke", {
        method: "POST",
        headers: {
          Cookie: "session=opaque",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ safe: true }),
      }),
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      method: "POST",
      url: "/api/v1/bookings?ref=smoke",
      cookie: "session=opaque",
      body: JSON.stringify({ safe: true }),
    });

    const forwardedCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
    assert.deepEqual(forwardedCookies, [
      "first=one; Path=/; HttpOnly",
      "second=two; Path=/; Secure",
    ]);
  } finally {
    if (previousOrigin === undefined) delete process.env.ZAT_INTERNAL_API_ORIGIN;
    else process.env.ZAT_INTERNAL_API_ORIGIN = previousOrigin;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("API proxy rejects origins that are not loopback HTTP", () => {
  const previousOrigin = process.env.ZAT_INTERNAL_API_ORIGIN;
  process.env.ZAT_INTERNAL_API_ORIGIN = "https://api.example";

  try {
    assert.throws(embeddedApiOrigin, /loopback HTTP origin/);
  } finally {
    if (previousOrigin === undefined) delete process.env.ZAT_INTERNAL_API_ORIGIN;
    else process.env.ZAT_INTERNAL_API_ORIGIN = previousOrigin;
  }
});
