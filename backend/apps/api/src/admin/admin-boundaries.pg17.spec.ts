import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AdminService } from "./admin.service";
import { UmrahOpsService } from "../umrah/umrah-ops.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import type { AuthUser } from "../auth/auth.types";

test(
  "PG17 legacy admin actions respect lifecycle and passenger branch boundaries",
  { skip: !process.env.ZAT_SYNTHETIC_DATABASE_URL },
  async (t) => {
    const url = new URL(process.env.ZAT_SYNTHETIC_DATABASE_URL!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55463");
    assert.equal(url.pathname, "/zat_synthetic_fullstack_20261028");
    const db = new PrismaClient({ datasourceUrl: url.href });
    try {
      const branch = await db.branch.create({
        data: { code: randomUUID(), name: "Synthetic admin branch" },
      });
      const other = await db.branch.create({
        data: { code: randomUUID(), name: "Synthetic foreign admin branch" },
      });
      const staff = await db.user.create({
        data: {
          username: randomUUID(),
          email: `${randomUUID()}@example.test`,
          fullName: "Synthetic administrator",
          passwordHash: "invalid",
        },
      });
      const user = {
        id: staff.id,
        isSuperAdmin: true,
        permissions: [],
        branchIds: [branch.id],
        defaultBranchId: branch.id,
      } as unknown as AuthUser;
      const customer = await db.customer.create({
        data: {
          customerNumber: randomUUID(),
          fullName: "Synthetic booking owner",
          branchId: branch.id,
        },
      });
      const seq = new SequenceService(db as never),
        audit = new AuditService(db as never),
        accounting = new AccountingService(db as never, seq, audit),
        umrah = new UmrahOpsService(db as never, seq, audit, accounting);
      const admin = new AdminService(
        db as never,
        audit,
        accounting,
        umrah,
        seq,
      );
      await t.test(
        "admin advance cannot bypass financial cancellation hold",
        async () => {
          const row = await db.umrahBooking.create({
            data: {
              bookingNumber: randomUUID(),
              customerId: customer.id,
              branchId: branch.id,
              status: "CONFIRMED",
              workflowStep: "Booked",
              net: 100,
              paid: 10,
              balance: 90,
            },
          });
          await assert.rejects(
            admin.advanceUmrah(user, row.id, "Cancelled", "Synthetic review"),
            { status: 409 },
          );
          assert.equal(
            (await db.umrahBooking.findUniqueOrThrow({ where: { id: row.id } }))
              .workflowStep,
            "Booked",
          );
        },
      );
      await t.test(
        "admin advance cannot reopen terminal cancellations or cross branches",
        async () => {
          const row = await db.umrahBooking.create({
            data: {
              bookingNumber: randomUUID(),
              customerId: customer.id,
              branchId: branch.id,
              status: "CANCELLED",
              workflowStep: "Cancelled",
            },
          });
          await assert.rejects(
            admin.advanceUmrah(user, row.id, "Completed", "Synthetic review"),
            { status: 400 },
          );
          const scoped = {
            ...user,
            isSuperAdmin: false,
            permissions: ["admin.advance", "umrah.edit"],
            branchIds: [other.id],
            defaultBranchId: other.id,
          };
          await assert.rejects(
            admin.advanceUmrah(scoped, row.id, "Cancelled", "Synthetic review"),
            { status: 404 },
          );
        },
      );
      await t.test(
        "duplicate-passenger tool excludes foreign and unowned passenger identifiers",
        async () => {
          const foreign = await db.customer.create({
            data: {
              customerNumber: randomUUID(),
              fullName: "Synthetic foreign owner",
              branchId: other.id,
            },
          });
          const passport = `SYN-${randomUUID()}`.toUpperCase();
          for (let i = 0; i < 2; i++) {
            await db.passenger.create({
              data: {
                fullName: `Synthetic own ${i}`,
                customerId: customer.id,
                passportNumber: passport,
              },
            });
            await db.passenger.create({
              data: {
                fullName: `Synthetic foreign ${i}`,
                customerId: foreign.id,
                passportNumber: `FOREIGN-${passport}`,
              },
            });
          }
          const scoped = {
            ...user,
            isSuperAdmin: false,
            permissions: ["passenger.view"],
          };
          const result = await admin.duplicateMutamers(scoped);
          assert.ok(result.groups.some((g) => g.key === passport));
          assert.ok(
            result.groups.every((g) => g.key !== `FOREIGN-${passport}`),
          );
        },
      );
      await t.test(
        "legacy destructive deletion and bulk repricing cannot mutate retained travel records",
        async () => {
          const count = await db.umrahBooking.count();
          await assert.rejects(
            admin.deleteRecord(
              user,
              "umrah",
              "synthetic-id",
              "DELETE",
              "Synthetic reason",
            ),
            { status: 409 },
          );
          await assert.rejects(admin.hotelDiscount(user, 5), { status: 409 });
          assert.equal(await db.umrahBooking.count(), count);
        },
      );
      await t.test(
        "concurrent customer imports share the normal sequence and audit failure rolls back",
        async () => {
          const result = await Promise.all([
            admin.importCustomers(user, [{ fullName: "Synthetic import A" }]),
            admin.importCustomers(user, [{ fullName: "Synthetic import B" }]),
          ]);
          assert.deepEqual(
            result.map((r) => r.count),
            [1, 1],
          );
          const imported = await db.customer.findMany({
            where: { fullName: { startsWith: "Synthetic import" } },
          });
          assert.equal(
            new Set(imported.map((c) => c.customerNumber)).size,
            imported.length,
          );
          const before = await db.customer.count();
          const failing = new AdminService(
            db as never,
            {
              log: async () => {
                throw new Error("Synthetic failure");
              },
            } as never,
            accounting,
            umrah,
            seq,
          );
          await assert.rejects(
            failing.importCustomers(user, [
              { fullName: "Synthetic import must roll back" },
            ]),
          );
          assert.equal(await db.customer.count(), before);
          await assert.rejects(
            admin.importCustomers(
              { ...user, isSuperAdmin: false, permissions: ["admin.import"] },
              [{ fullName: "No" }],
            ),
            { status: 403 },
          );
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
