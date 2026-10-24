import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaClient } from "../../../backend/node_modules/@prisma/client";
import { WebsiteCustomerBookingsService } from "../../../backend/apps/api/src/website/website-customer-bookings.service";
import { customerDatabase } from "@/server/customer-db/db";
import * as repository from "@/server/customer-db/repository";
import { resolveCustomerSession } from "@/server/customer-auth/session";
import { resolveAccountBookings } from "@/server/customer-bookings/resolve";

const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test("PG17 account sessions and verified CRM links isolate booking visibility", { skip: !url }, async () => {
  const target = new URL(url!);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_[a-z0-9_]+$/);
  process.env.DATABASE_URL = url;
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [server] = await db.$queryRaw<{ version: number }[]>`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    const website = await repository.insertCustomer({ email: `${randomUUID()}@example.test`, displayName: "Synthetic account", passwordHash: "invalid" });
    const crm = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Synthetic customer", email: website.email } });
    const own = await db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: crm.id, departureDate: new Date("2030-01-10"), status: "CONFIRMED", net: 100, paid: 20, balance: 80 } });
    const other = await db.customer.create({ data: { customerNumber: randomUUID(), fullName: "Other synthetic customer" } });
    const foreign = await db.umrahBooking.create({ data: { bookingNumber: randomUUID(), customerId: other.id, departureDate: new Date("2030-01-11"), status: "CONFIRMED" } });
    const tokenHash = randomUUID();
    await repository.insertSession({ customerId: website.id, tokenHash, expiresAt: new Date(Date.now() + 60000).toISOString() });
    await repository.setCustomerCrmId(website.id, crm.id);
    const session = await resolveCustomerSession(tokenHash);
    assert.equal(session?.id, website.id);
    const service = new WebsiteCustomerBookingsService(db as never);
    const fetchBookings = async (id: string) => ({ ok: true as const, ...(await service.listForWebsiteCustomer(id)) });
    assert.equal((await resolveAccountBookings(session, fetchBookings)).status, 403);
    await db.auditLog.create({ data: { action: "VERIFY_WEBSITE_CUSTOMER_LINK", entity: "WebsiteCustomer", entityId: website.id, after: { crmCustomerId: crm.id } } });
    const result = await resolveAccountBookings(session, fetchBookings);
    assert.equal(result.status, 200);
    assert.ok(result.body.ok);
    if (result.body.ok) {
      assert.deepEqual(result.body.bookings.map(row => row.reference), [own.bookingNumber]);
      assert.ok(!JSON.stringify(result.body).includes(foreign.bookingNumber));
      assert.ok(!JSON.stringify(result.body).includes("balance"));
    }
    // An altered CRM selector is denied unless that exact account link was verified.
    assert.equal((await resolveAccountBookings({ ...session!, crmCustomerId: other.id }, fetchBookings)).status, 403);
    await repository.revokeSessionByTokenHash(tokenHash);
    assert.equal(await resolveCustomerSession(tokenHash), null);
    assert.equal((await resolveAccountBookings(await resolveCustomerSession(tokenHash), fetchBookings)).status, 401);
  } finally { await db.$disconnect(); await customerDatabase().end(); }
});
