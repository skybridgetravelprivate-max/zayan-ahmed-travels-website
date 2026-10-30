import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ManagementService } from "./management.service";
import { DashboardController } from "../dashboard/dashboard.controller";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { NotifyService } from "../common/notify.service";
import { CrmService } from "../crm/crm.service";
import type { AuthUser } from "../auth/auth.types";
const url = process.env.ZAT_SYNTHETIC_DATABASE_URL;
test(
  "PG17 admin experience: operational counts, scoped filters, labels and bounded previews",
  { skip: !url },
  async (t) => {
    const target = new URL(url!);
    assert.equal(target.hostname, "127.0.0.1");
    assert.match(target.pathname, /^\/zat_synthetic_crm_[a-z0-9_]+$/);
    const db = new PrismaClient({ datasourceUrl: url });
    try {
      const [version] = await db.$queryRaw<
        { v: number }[]
      >`SELECT current_setting('server_version_num')::int AS v`;
      assert.ok(version.v >= 170000 && version.v < 180000);
      await db.companySettings.create({
        data: {
          companyName: "Synthetic admin company",
          timezone: "Asia/Karachi",
        },
      });
      const a = await db.branch.create({
          data: { code: randomUUID(), name: "Synthetic branch A" },
        }),
        b = await db.branch.create({
          data: { code: randomUUID(), name: "Synthetic branch B" },
        });
      const staff = await db.user.create({
        data: {
          username: randomUUID(),
          email: randomUUID() + "@example.test",
          fullName: "Synthetic local owner",
          passwordHash: "invalid",
          defaultBranchId: a.id,
        },
      });
      const foreign = await db.user.create({
        data: {
          username: randomUUID(),
          email: randomUUID() + "@example.test",
          fullName: "Synthetic forbidden owner",
          passwordHash: "invalid",
          defaultBranchId: b.id,
        },
      });
      const actor: AuthUser = {
        id: staff.id,
        email: staff.email,
        username: staff.username,
        fullName: staff.fullName,
        permissions: [
          "dashboard.view",
          "lead.view",
          "lead.edit",
          "lead.assign",
          "customer.view",
          "task.view",
          "followup.view",
          "quotation.view",
          "booking.view",
        ],
        roleNames: [],
        branchIds: [a.id],
        defaultBranchId: a.id,
        isSuperAdmin: false,
      };
      const admin = { ...actor, isSuperAdmin: true };
      const seq = new SequenceService(db as never),
        service = new ManagementService(db as never, seq),
        dashboard = new DashboardController(db as never);
      const before = new Date("2026-10-31T18:59:59Z"),
        inside = new Date("2026-10-31T19:00:00Z"),
        after = new Date("2026-11-30T19:00:00Z");
      const customer = await db.customer.create({
        data: {
          customerNumber: randomUUID(),
          fullName: "Synthetic current customer",
          branchId: a.id,
          createdAt: inside,
        },
      });
      await db.customer.create({
        data: {
          customerNumber: randomUUID(),
          fullName: "Synthetic earlier customer",
          branchId: a.id,
          createdAt: before,
        },
      });
      await db.customer.create({
        data: {
          customerNumber: randomUUID(),
          fullName: "Synthetic foreign customer",
          branchId: b.id,
          createdAt: inside,
        },
      });
      await db.customer.create({
        data: {
          customerNumber: randomUUID(),
          fullName: "Synthetic future timestamp",
          branchId: a.id,
          createdAt: new Date("2026-11-20T12:00:00Z"),
        },
      });
      await db.umrahBooking.create({
        data: {
          bookingNumber: randomUUID(),
          customerId: customer.id,
          branchId: a.id,
          status: "CONFIRMED",
          createdAt: inside,
        },
      });
      await t.test(
        "month counters use Karachi boundaries and actual module authority",
        async () => {
          const value = await dashboard.workspace(
            { user: actor } as never,
            new Date("2026-11-01T01:00:00Z"),
          );
          assert.equal(value.period.start.toISOString(), inside.toISOString());
          assert.equal(
            value.period.endExclusive.toISOString(),
            after.toISOString(),
          );
          assert.equal(
            value.metrics.find((m) => m.key === "customers")?.value,
            1,
          );
          assert.equal(
            value.metrics.find((m) => m.key === "confirmedUmrah")?.value,
            1,
          );
          assert.equal(
            value.metrics.find((m) => m.key === "pendingUmrahVisas")?.value,
            null,
          );
          const limited = await dashboard.workspace(
            {
              user: { ...actor, permissions: ["dashboard.view", "umrah.view"] },
            } as never,
            new Date("2026-11-01T01:00:00Z"),
          );
          assert.ok(limited.metrics.every((m) => m.value === null));
        },
      );
      const leads = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          db.lead.create({
            data: {
              leadNumber: randomUUID(),
              fullName: `Filter sample ${String(i).padStart(2, "0")}`,
              mobile: "+000",
              branchId: a.id,
              assignedUserId: staff.id,
              status: "CONTACTED",
              createdAt: new Date("2026-11-01T02:00:00Z"),
            },
          }),
        ),
      );
      const hidden = await db.lead.create({
        data: {
          leadNumber: randomUUID(),
          fullName: "Filter forbidden branch",
          mobile: "+000",
          branchId: b.id,
          status: "CONTACTED",
          createdAt: inside,
        },
      });
      await t.test(
        "filters and totals apply before pagination without overriding branch scope",
        async () => {
          const query = {
            q: "Filter",
            status: "CONTACTED",
            assignedUserId: staff.id,
            from: "2026-11-01",
            to: "2026-11-01",
            sort: "name",
          };
          const one = await service.list(actor, "leads", query),
            two = await service.list(actor, "leads", { ...query, page: "2" });
          assert.equal(one.total, 25);
          assert.equal(one.data.length, 20);
          assert.equal(two.data.length, 5);
          assert.ok(one.data.every((row) => row.id !== hidden.id));
          assert.equal(one.data[0].fullName, "Filter sample 00");
          assert.equal(
            (await service.list(actor, "leads", { branchId: b.id })).total,
            0,
          );
          await assert.rejects(
            service.list(actor, "leads", { from: "2026-02-30" }),
          );
          await assert.rejects(
            service.list(actor, "leads", { status: "INVALID" }),
          );
          await assert.rejects(
            service.list(actor, "leads", { sort: "passwordHash" }),
          );
        },
      );
      await t.test(
        "names resolve only inside scope and summaries omit credentials",
        async () => {
          const value = await service.summary(actor, "leads", leads[0].id);
          assert.equal(
            value.presentation.references.assignedUserId.label,
            "Synthetic local owner",
          );
          assert.match(
            value.presentation.references.branchId.label,
            /Synthetic branch A/,
          );
          assert.ok(!JSON.stringify(value).includes("passwordHash"));
          const bad = await db.lead.create({
            data: {
              leadNumber: randomUUID(),
              fullName: "Synthetic legacy assignment",
              mobile: "+000",
              branchId: a.id,
              assignedUserId: foreign.id,
            },
          });
          assert.equal(
            (await service.summary(actor, "leads", bad.id)).presentation
              .references.assignedUserId.label,
            "Restricted or unavailable record",
          );
          await assert.rejects(service.summary(actor, "leads", hidden.id));
          const rows = await service.list(actor, "leads", {
            q: "Filter",
            presentation: "true",
          });
          assert.equal(rows.data.length, 20);
          assert.equal(rows.data[0].presentation?.timeZone, "Asia/Karachi");
        },
      );
      await t.test(
        "related previews are bounded and never present a partial balance as a total",
        async () => {
          await db.leadNote.createMany({
            data: Array.from({ length: 25 }, (_, i) => ({
              leadId: leads[0].id,
              userId: staff.id,
              body: `Synthetic note ${i}`,
            })),
          });
          const crm = new CrmService(
            db as never,
            seq,
            new AuditService(db as never),
            new NotifyService(db as never),
            {} as never,
            {} as never,
            {} as never,
          );
          assert.equal(
            (await crm.workspace(leads[0].id, actor, true)).lead.leadNotes
              .length,
            20,
          );
          await db.task.createMany({
            data: Array.from({ length: 25 }, (_, i) => ({
              customerId: customer.id,
              title: `Synthetic customer task ${i}`,
            })),
          });
          const value = await crm.customerWorkspace(customer.id, actor, true);
          assert.equal(value.customer.tasks.length, 20);
          assert.equal(value.outstanding, null);
          assert.equal(value.outstandingScope, "not-calculated-in-preview");
          assert.equal(
            (
              await crm.workspace(
                leads[0].id,
                { ...actor, permissions: ["lead.view"] },
                true,
              )
            ).lead.tasks.length,
            0,
          );
        },
      );
      await t.test(
        "operational roles retain useful catalogue access with no dashboard permission",
        async () => {
          const keys = service
            .catalog({ ...actor, permissions: ["hotel.view", "hotel.booking"] })
            .map((m) => m.key);
          assert.ok(keys.includes("hotel-bookings"));
          assert.ok(!keys.includes("users"));
          assert.ok(!keys.includes("leads"));
          assert.ok(service.catalog(admin).length > keys.length);
          const web = { ...actor, permissions: ["cms.view"] };
          assert.ok(
            service.catalog(web).some((module) => module.key === "cms-pages"),
          );
          await assert.rejects(service.list(web, "cms-pages", {}));
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
