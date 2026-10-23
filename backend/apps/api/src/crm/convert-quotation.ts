import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser } from "../auth/auth.types";
import { assertBranch, assertPeopleLinks, assertRecordBranch } from "../auth/record-scope";
import { SequenceService } from "../common/sequence.service";
import { AccountingService } from "../finance/accounting.service";

export async function convertQuotationToBooking(tx: Prisma.TransactionClient, seq: SequenceService, accounting: AccountingService, id: string, user: AuthUser) {

    await tx.$queryRaw`SELECT id FROM "Quotation" WHERE id = ${id} FOR UPDATE`;
    const q = await tx.quotation.findUnique({ where: { id }, include: { items: true } });
    if (!q) throw new BadRequestException("Quotation not found");
    assertBranch(user, q.branchId);
    if (!q.customerId) throw new BadRequestException("Quotation has no customer");
    await assertPeopleLinks(tx, user, q);
    if (q.leadId) await assertRecordBranch(tx, user, "lead", q.leadId);
    const existing = await tx.umrahBooking.findFirst({ where: { quotationId: id } });
    if (existing) return existing;
    if (["CONVERTED", "REJECTED", "EXPIRED"].includes(q.status)) throw new ConflictException("Quotation cannot be converted in its current state");
    const bookingNumber = await seq.next("umrah-bk", "ZAT-UM", tx);
    const booking = await tx.umrahBooking.create({
      data: {
        bookingNumber,
        customerId: q.customerId,
        quotationId: q.id,
        agentId: q.agentId,
        branchId: q.branchId,
        cost: q.costTotal,
        sellingPrice: q.sellingTotal,
        discount: q.discount,
        tax: q.tax,
        net: q.net,
        paid: 0,
        balance: q.net,
        profit: Number(q.net) - Number(q.costTotal),
        status: "QUOTED",
        workflowStep: "QUOTATION",
      },
    });
    await tx.quotation.update({ where: { id }, data: { status: "CONVERTED" } });
    await accounting.postSale({
      db: tx,
      userId: user.id,
      module: "umrah",
      sourceId: booking.id,
      amount: Number(booking.net),
      customerId: booking.customerId,
      branchId: booking.branchId,
      memo: `Umrah ${booking.bookingNumber}`,
    });
    await accounting.postCost({
      db: tx,
      userId: user.id,
      module: "umrah",
      sourceId: booking.id,
      amount: Number(booking.cost),
      branchId: booking.branchId,
      memo: `Umrah cost ${booking.bookingNumber}`,
    });
    return booking;
}
