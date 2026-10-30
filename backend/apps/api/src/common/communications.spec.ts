import assert from "node:assert/strict";
import { test } from "node:test";
import { WhatsAppService } from "./whatsapp.service";
import { MailService } from "./mail.service";
import nodemailer from "nodemailer";

test("unconfigured communications skip without sending or logging contact data", async t => {
  const old = { url: process.env.WHATSAPP_API_URL, token: process.env.WHATSAPP_API_TOKEN, smtp: process.env.SMTP_HOST };
  delete process.env.WHATSAPP_API_URL; delete process.env.WHATSAPP_API_TOKEN; delete process.env.SMTP_HOST;
  const logs: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => logs.push(args));
  t.mock.method(globalThis, "fetch", async () => { throw Error("must not send"); });
  try {
    assert.equal((await new WhatsAppService().send("synthetic-private-number", "synthetic-private-message")).skipped, true);
    assert.equal((await new MailService().send("synthetic-private@example.test", "synthetic-private-subject", "body") as { skipped: boolean }).skipped, true);
    assert.doesNotMatch(JSON.stringify(logs), /synthetic-private/);
  } finally {
    for (const [key, value] of [["WHATSAPP_API_URL", old.url], ["WHATSAPP_API_TOKEN", old.token], ["SMTP_HOST", old.smtp]]) { if (value === undefined) delete process.env[key!]; else process.env[key!] = value; }
  }
});

test("WhatsApp rejection, malformed response and network failures return redacted errors", async t => {
  const oldUrl = process.env.WHATSAPP_API_URL, oldToken = process.env.WHATSAPP_API_TOKEN;
  process.env.WHATSAPP_API_URL = "https://synthetic-provider.invalid"; process.env.WHATSAPP_API_TOKEN = "synthetic-secret";
  try {
    for (const response of [new Response('{"error":"synthetic-secret"}', { status: 400 }), new Response("invalid-json", { status: 200 }), new Error("synthetic-secret")]) {
      const mocked = t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => { assert.ok(options.signal); if (response instanceof Error) throw response; return response; });
      await assert.rejects(new WhatsAppService().send("synthetic", "synthetic"), e => { assert.equal((e as { status: number }).status, 502); assert.doesNotMatch(String(e), /synthetic-secret/); return true; });
      mocked.mock.restore();
    }
    t.mock.method(globalThis, "fetch", async () => new Response('{"id":"synthetic-ok"}', { status: 200 }));
    assert.deepEqual(await new WhatsAppService().send("synthetic", "synthetic"), { id: "synthetic-ok" });
  } finally {
    if (oldUrl === undefined) delete process.env.WHATSAPP_API_URL; else process.env.WHATSAPP_API_URL = oldUrl;
    if (oldToken === undefined) delete process.env.WHATSAPP_API_TOKEN; else process.env.WHATSAPP_API_TOKEN = oldToken;
  }
});


test("mail uses approved CEO sender by default and preserves explicit SMTP override without delivery", async t => {
  const oldHost = process.env.SMTP_HOST, oldFrom = process.env.SMTP_FROM;
  const messages: {from: string}[] = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message: {from: string}) => { messages.push(message); return { accepted: ["synthetic@example.test"] }; } }) as never);
  try {
    process.env.SMTP_HOST = "mocked-no-network.invalid"; delete process.env.SMTP_FROM;
    const service = new MailService();
    await service.send("synthetic@example.test", "Synthetic sender test", "Synthetic only");
    assert.equal(messages[0].from, "ceo@zayanahmedtravels.com");
    process.env.SMTP_FROM = "explicit@example.test";
    await service.send("synthetic@example.test", "Synthetic sender test", "Synthetic only");
    assert.equal(messages[1].from, "explicit@example.test");
  } finally {
    if (oldHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = oldHost;
    if (oldFrom === undefined) delete process.env.SMTP_FROM; else process.env.SMTP_FROM = oldFrom;
  }
});
