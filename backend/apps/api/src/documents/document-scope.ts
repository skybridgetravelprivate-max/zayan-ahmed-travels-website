import { NotFoundException } from "@nestjs/common";
import { AuthUser } from "../auth/auth.types";
import { assertBranch, assertPassengerBranch, assertPeopleLinks, assertRecordBranch, requirePermission } from "../auth/record-scope";
import { PrismaService } from "../common/prisma.service";

// Explicit ownership paths; unknown attachment types fail closed.
const owners: Record<string, { model: string; permission: string; parent?: [string, string] }> = {
  lead: { model: "lead", permission: "lead" }, customer: { model: "customer", permission: "customer" },
  passenger: { model: "passenger", permission: "passenger" }, quotation: { model: "quotation", permission: "quotation" },
  umrahBooking: { model: "umrahBooking", permission: "booking" }, hotelBooking: { model: "hotelBooking", permission: "hotel" },
  hotelVoucher: { model: "hotelVoucher", permission: "hotel", parent: ["hotelBooking", "bookingId"] },
  transportBooking: { model: "transportBooking", permission: "transport" },
  transportVoucher: { model: "transportVoucher", permission: "transport", parent: ["transportBooking", "bookingId"] },
  ticketSale: { model: "ticketSale", permission: "ticket" }, ticketRefund: { model: "ticketRefund", permission: "ticket", parent: ["ticketSale", "ticketId"] },
  serviceInvoice: { model: "serviceInvoice", permission: "account" }, receipt: { model: "receipt", permission: "account" },
  salarySlip: { model: "salarySlip", permission: "hr" }, complaint: { model: "complaint", permission: "complaint" },
};
export async function authorizeDocumentOwner(db: PrismaService, user: AuthUser, type: string, id: string): Promise<void> {
  const owner = Object.hasOwn(owners, type) ? owners[type] : undefined;
  if (!owner) throw new NotFoundException();
  requirePermission(user, owner.permission + ".view");
  const delegate = (db as unknown as Record<string, { findUnique(args: unknown): Promise<Record<string, unknown> | null> }>)[owner.model];
  const row = await delegate.findUnique({ where: { id } });
  if (!row) throw new NotFoundException();
  if (owner.parent) return authorizeDocumentOwner(db, user, owner.parent[0], String(row[owner.parent[1]]));
  if (type === "passenger") return assertPassengerBranch(db, user, row.customerId);
  // HR has no branch ownership in the schema; hr.view is its access boundary.
  if (type !== "salarySlip") {
    assertBranch(user, row.branchId);
    await assertPeopleLinks(db, user, row);
    if (row.leadId) await assertRecordBranch(db, user, "lead", row.leadId);
  }
}

export async function authorizeStoredDocument(db: PrismaService, user: AuthUser, doc: { entityType?: unknown; entityId?: unknown; uploadedById?: unknown }) {
  if (doc.entityType || doc.entityId) {
    if (typeof doc.entityType !== "string" || !doc.entityType || typeof doc.entityId !== "string" || !doc.entityId) throw new NotFoundException();
    return authorizeDocumentOwner(db, user, doc.entityType, doc.entityId);
  }
  if (!user.isSuperAdmin && doc.uploadedById !== user.id) throw new NotFoundException();
}
