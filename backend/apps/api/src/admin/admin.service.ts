import { UmrahOpsService } from "../umrah/umrah-ops.service";
import { resourceScope } from "../resources/resource-scope";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { SequenceService } from "../common/sequence.service";
import { RESOURCES } from "../resources/registry";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import { AuthUser, can } from "../auth/auth.types";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private accounting: AccountingService,
    private umrah: UmrahOpsService,
    private seq: SequenceService,
  ) {}

  assert(user: AuthUser, perm: string) {
    if (!can(user, perm)) throw new ForbiddenException(perm);
    if (
      ["admin.post", "admin.discount", "admin.delete", "admin.import"].includes(
        perm,
      ) &&
      !user.isSuperAdmin
    )
      throw new ForbiddenException(
        "Global administration requires super-admin access",
      );
  }

  async postUnposted(user: AuthUser) {
    this.assert(user, "admin.post");
    const drafts = await this.prisma.journalEntry.findMany({
      where: { status: "DRAFT" },
    });
    let count = 0;
    for (const j of drafts) {
      await this.accounting.postExisting(j.id, user.id);
      count += 1;
    }
    await this.audit.log({
      userId: user.id,
      action: "post",
      entity: "JournalEntry",
      after: { count },
    });
    return { count };
  }

  async hotelDiscount(user: AuthUser, percent: number) {
    this.assert(user, "admin.discount");
    if (!(percent > 0) || percent > 90)
      throw new BadRequestException("Invalid percent");
    throw new ConflictException(
      "Bulk room repricing requires reviewed reservation and accounting reconciliation; no prices were changed",
    );
  }

  async advanceUmrah(
    user: AuthUser,
    id: string,
    status: string,
    reason: string,
  ) {
    this.assert(user, "admin.advance");
    if (!reason) throw new BadRequestException("Reason required");
    return this.umrah.lifecycle(user, id, status, undefined, reason);
  }

  async deleteRecord(
    user: AuthUser,
    kind: string,
    id: string,
    confirm: string,
    reason: string,
  ) {
    this.assert(user, "admin.delete");
    if (!user.isSuperAdmin) throw new ForbiddenException("Super Admin only");
    if (confirm !== "DELETE")
      throw new BadRequestException("Type DELETE to confirm");
    if (!reason) throw new BadRequestException("Reason required");
    throw new ConflictException(
      "Travel records must be retained; use the authorized cancellation and reversal workflow",
    );
  }

  async duplicateMutamers(user: AuthUser) {
    this.assert(user, "passenger.view");
    const people = await this.prisma.passenger.findMany({
      where: { deletedAt: null, ...resourceScope(user, "passengers") },
    });
    const byPass = new Map<string, typeof people>();
    const byCnic = new Map<string, typeof people>();
    for (const p of people) {
      const pass = String(p.passportNumber || "")
        .trim()
        .toUpperCase();
      const cnic = String(p.cnic || "").trim();
      if (pass) byPass.set(pass, [...(byPass.get(pass) || []), p]);
      if (cnic) byCnic.set(cnic, [...(byCnic.get(cnic) || []), p]);
    }
    const groups = [...byPass.entries(), ...byCnic.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({
        key,
        names: list.map((p) => p.fullName),
        ids: list.map((p) => p.id),
      }));
    return { groups };
  }

  async importCustomers(user: AuthUser, rows: Record<string, string>[]) {
    this.assert(user, "admin.import");
    if (!Array.isArray(rows) || rows.length > 500)
      throw new BadRequestException("Use a batch of at most 500 customers");
    return this.prisma.$transaction(async (tx) => {
      const errors: string[] = [];
      let count = 0;
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (
          !row ||
          typeof row !== "object" ||
          Object.values(row).some(
            (v) => typeof v !== "string" || v.length > 400,
          )
        )
          throw new BadRequestException("Invalid customer import row");
        const fullName = String(row.name || row.fullName || "").trim();
        if (!fullName) {
          errors.push(`Row ${i + 1}: name required`);
          continue;
        }
        const numbering = RESOURCES.customers.number!;
        await tx.customer.create({
          data: {
            customerNumber: await this.seq.next(
              numbering.key,
              numbering.prefix,
              tx,
            ),
            fullName,
            branchId: user.defaultBranchId,
            phone: row.phone || row.mobile || undefined,
            email: row.email || undefined,
            cnic: row.cnic || undefined,
            passportNumber: row.passport || row.passportNumber || undefined,
          },
        });
        count += 1;
      }
      await this.audit.log({
        userId: user.id,
        action: "import",
        entity: "Customer",
        after: { count, errors },
        db: tx,
      });
      return { count, errors };
    });
  }
}
