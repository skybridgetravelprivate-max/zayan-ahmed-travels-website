import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../common/password";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Exercise compiled Nest constructor metadata.
const { createNestApp } = require("../../dist/create-app") as typeof import("../create-app");

test("PG17 external selling documents enforce publication, ownership and current membership", { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL }, async t => {
  const target = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/zat_synthetic_/);
  assert.equal(process.env.DATABASE_URL, process.env.ZAT_SYNTHETIC_DATABASE_URL);
  const db = new PrismaClient();
  const previous = { portal: process.env.AGENT_PORTAL_ENABLED, documents: process.env.AGENT_DOCUMENTS_ENABLED };
  process.env.AGENT_PORTAL_ENABLED = "true";
  process.env.AGENT_DOCUMENTS_ENABLED = "true";
  const suffix = randomUUID();
  const password = randomUUID();
  const branch = await db.branch.create({ data: { code: suffix, name: "Synthetic document agency branch" } });
  const agency = await db.agent.create({ data: { name: "Synthetic document agency", branchId: branch.id } });
  const other = await db.agent.create({ data: { name: "Synthetic other agency", branchId: branch.id } });
  const user = await db.user.create({ data: { email: suffix + "@example.test", username: suffix, fullName: "Synthetic document agent", passwordHash: await hashPassword(password) } });
  await db.agencyMembership.create({ data: { userId: user.id, agentId: agency.id } });
  const customer = await db.customer.create({ data: { customerNumber: suffix, fullName: "PRIVATE_CUSTOMER_MARKER", branchId: branch.id } });
  const quote = await db.quotation.create({ data: { quotationNumber: suffix, agentId: agency.id, branchId: branch.id, status: "SENT", currency: "PKR", net: "500000.50", sellingTotal: "500000.50", costTotal: "123456.78",
    items: { create: Array.from({ length: 80 }, (_, index) => ({ description: `Public selling line ${String(index).padStart(2, "0")} - synthetic approved description`, quantity: 1, sellingPrice: index === 0 ? "6250.50" : "6250.00", cost: "999.99" })) } } });
  const booking = await db.umrahBooking.create({ data: { bookingNumber: suffix, customerId: customer.id, agentId: agency.id, branchId: branch.id, quotationId: quote.id, status: "CONFIRMED", net: "500000.50", paid: "0", balance: "500000.50", cost: "123456.78", notes: "PRIVATE_INTERNAL_MARKER" } });
  const app = await createNestApp(); await app.listen(0, "127.0.0.1"); const base = await app.getUrl();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Match the compiled application provider identity.
  const { DocumentPdfService } = require("../../dist/documents/document-pdf.service") as typeof import("../documents/document-pdf.service");
  Object.assign(app.get(DocumentPdfService), { company: async () => ({ companyName: "Synthetic public agency", terms: "PRIVATE_COMPANY_TERMS" }) });
  try {
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: user.email, password, portal: "agent" }) });
    assert.equal(login.status, 201);
    const cookie = login.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
    const get = (kind: string, id: string) => fetch(base + `/api/v1/agent/documents/${kind}/${id}`, { headers: { Cookie: cookie } });
    await t.test("selling-only PDF output is private, audited and multipage-ready", async () => {
      for (const [kind, id] of [["quotation", quote.id], ["umrah-booking", booking.id]]) {
        const response = await get(kind, id); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
        assert.match(response.headers.get("Content-Disposition") || "", /^attachment; filename="[^"\r\n]+\.pdf"$/);
        const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
        if (process.env.ZAT_SYNTHETIC_PDF_OUTPUT) {
          await mkdir(process.env.ZAT_SYNTHETIC_PDF_OUTPUT, { recursive: true });
          await writeFile(`${process.env.ZAT_SYNTHETIC_PDF_OUTPUT}/external-${kind}.pdf`, bytes);
        }
      }
      assert.equal(await db.auditLog.count({ where: { action: "agency.document-request", userId: user.id } }), 2);
    });
    await t.test("disabled publication, drafts and unconfirmed/cancelled bookings fail closed", async () => {
      process.env.AGENT_DOCUMENTS_ENABLED = "false"; assert.equal((await get("quotation", quote.id)).status, 503); process.env.AGENT_DOCUMENTS_ENABLED = "true";
      await db.quotation.update({ where: { id: quote.id }, data: { status: "DRAFT" } }); assert.equal((await get("quotation", quote.id)).status, 404);
      await db.quotation.update({ where: { id: quote.id }, data: { status: "SENT" } });
      for (const status of ["QUOTED", "CANCELLED"] as const) { await db.umrahBooking.update({ where: { id: booking.id }, data: { status } }); assert.equal((await get("umrah-booking", booking.id)).status, 404); }
      await db.umrahBooking.update({ where: { id: booking.id }, data: { status: "CONFIRMED" } });
    });
    await t.test("guessed IDs, reassignment, branch changes and revocation stop downloads", async () => {
      assert.equal((await get("quotation", "nonexistent")).status, 404);
      await db.quotation.update({ where: { id: quote.id }, data: { agentId: other.id } }); assert.equal((await get("quotation", quote.id)).status, 404);
      await db.quotation.update({ where: { id: quote.id }, data: { agentId: agency.id, branchId: null } }); assert.equal((await get("quotation", quote.id)).status, 404);
      await db.umrahBooking.update({ where: { id: booking.id }, data: { agentId: other.id } }); assert.equal((await get("umrah-booking", booking.id)).status, 404);
      await db.agencyMembership.update({ where: { userId: user.id }, data: { active: false } }); assert.equal((await get("quotation", quote.id)).status, 401);
      assert.equal((await fetch(base + `/api/v1/agent/documents/quotation/${quote.id}`)).status, 401);
      assert.equal(await db.auditLog.count({ where: { action: "agency.document-request", userId: user.id } }), 2, "Denied requests must not record a successful document request");
    });
  } finally {
    await app.close(); await db.$disconnect();
    if (previous.portal === undefined) delete process.env.AGENT_PORTAL_ENABLED; else process.env.AGENT_PORTAL_ENABLED = previous.portal;
    if (previous.documents === undefined) delete process.env.AGENT_DOCUMENTS_ENABLED; else process.env.AGENT_DOCUMENTS_ENABLED = previous.documents;
  }
});
