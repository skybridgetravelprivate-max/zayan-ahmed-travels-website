import { NotFoundException } from "@nestjs/common";
import { Customer, Prisma } from "@prisma/client";
import { assertBranch } from "../auth/record-scope";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";

// Both conversion routes must serialize on the same lead and commit together.
export async function convertLeadToCustomer(prisma: PrismaService, seq: SequenceService, audit: AuditService, id: string, user: AuthUser, tx?: Prisma.TransactionClient): Promise<Customer> {
    if (!tx) return prisma.$transaction(db => convertLeadToCustomer(prisma, seq, audit, id, user, db));
    await tx.$queryRaw`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE`;
    const lead = await tx.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException("Lead not found");
    assertBranch(user, lead.branchId);
    const existing = await tx.customer.findFirst({ where: { leadId: id } });
    if (existing) return existing;
    const customerNumber = await seq.next("customer", "ZAT-CUS", tx);
    const customer = await tx.customer.create({ data: {
      customerNumber, fullName: lead.fullName, fatherName: lead.fatherName,
      phone: lead.mobile, whatsapp: lead.whatsapp, email: lead.email,
      cnic: lead.cnic, passportNumber: lead.passport, branchId: lead.branchId,
      agentId: lead.assignedAgentId, leadId: lead.id,
    } });
    await tx.lead.update({ where: { id }, data: { status: "CONFIRMED" } });
    await audit.log({ userId: user.id, action: "CONVERT", entity: "lead", entityId: id, after: customer, db: tx });
    return customer;
}
