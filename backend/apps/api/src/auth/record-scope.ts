import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AuthUser, can } from "./auth.types";
import { PrismaService } from "../common/prisma.service";
export function branchIds(user: AuthUser) {
  return [...new Set([...user.branchIds, ...(user.defaultBranchId ? [user.defaultBranchId] : [])])];
}
export function assertBranch(user: AuthUser, branchId: unknown) {
  if (!user.isSuperAdmin && (typeof branchId !== "string" || !branchIds(user).includes(branchId))) throw new NotFoundException();
}
export function requirePermission(user: AuthUser, permission: string) {
  if (!can(user, permission)) throw new ForbiddenException(permission);
}
export async function assertPassengerBranch(db: PrismaService, user: AuthUser, customerId: unknown) {
  if (user.isSuperAdmin) return;
  if (typeof customerId !== "string" || !customerId) throw new NotFoundException();
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundException();
  assertBranch(user, customer.branchId);
  if (customer.leadId) await assertRecordBranch(db, user, "lead", customer.leadId);
}

export type ScopeDb = Pick<PrismaService, "customer" | "passenger" | "lead" | "quotation" | "umrahBooking" | "hotelBooking" | "ticketSale" | "transportBooking" | "starBooking" | "umrahGroup">;
export function branchWhere(user: AuthUser) {
  return user.isSuperAdmin ? {} : { branchId: { in: branchIds(user) } };
}
export function customerBranchWhere(user: AuthUser) {
  return user.isSuperAdmin ? {} : {
    ...branchWhere(user),
    AND: [{ OR: [{ leadId: null }, { lead: branchWhere(user) }] }],
  };
}
export function ticketInvoiceWhere(user: AuthUser): Prisma.TicketSaleWhereInput {
  if (user.isSuperAdmin) return {};
  const people = customerBranchWhere(user);
  return {
    ...branchWhere(user),
    AND: [
      { OR: [{ customerId: null }, { customer: people }] },
      { OR: [{ passengerId: null }, { passenger: { customer: people } }] },
    ],
  };
}
export async function assertRecordBranch(db: ScopeDb, user: AuthUser, model: keyof ScopeDb, id: unknown) {
  if (typeof id !== "string" || !id) throw new NotFoundException();
  const delegate = db[model] as unknown as { findUnique(args: { where: { id: string } }): Promise<{ branchId?: string | null; customerId?: string | null; leadId?: string | null } | null> };
  const row = await delegate.findUnique({ where: { id } });
  if (!row) throw new NotFoundException();
  if (model === "passenger") await assertPassengerBranch(db as PrismaService, user, row.customerId);
  else {
    assertBranch(user, row.branchId);
    if (model === "customer" && row.leadId) await assertRecordBranch(db, user, "lead", row.leadId);
  }
}
export async function assertPeopleLinks(db: ScopeDb, user: AuthUser, body: { customerId?: unknown; passengerId?: unknown; passengerIds?: unknown }) {
  if (body.customerId) await assertRecordBranch(db, user, "customer", body.customerId);
  if (body.passengerId) await assertRecordBranch(db, user, "passenger", body.passengerId);
  if (body.passengerIds !== undefined) {
    if (!Array.isArray(body.passengerIds) || body.passengerIds.length > 100) throw new NotFoundException();
    for (const id of body.passengerIds) await assertRecordBranch(db, user, "passenger", id);
  }
}

export async function assertPeopleLinksInBranch(
  db: ScopeDb,
  body: { customerId?: unknown; passengerId?: unknown },
  branchId: unknown,
) {
  if (branchId == null) return;
  if (typeof branchId !== "string" || !branchId) throw new NotFoundException();

  const assertCustomerBranch = async (id: unknown) => {
    if (typeof id !== "string" || !id) throw new NotFoundException();
    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer || customer.branchId !== branchId) throw new NotFoundException();
    if (customer.leadId) {
      const lead = await db.lead.findUnique({ where: { id: customer.leadId } });
      if (!lead || lead.branchId !== branchId) throw new NotFoundException();
    }
  };

  if (body.customerId) await assertCustomerBranch(body.customerId);
  if (body.passengerId) {
    if (typeof body.passengerId !== "string") throw new NotFoundException();
    const passenger = await db.passenger.findUnique({ where: { id: body.passengerId } });
    if (!passenger?.customerId) throw new NotFoundException();
    await assertCustomerBranch(passenger.customerId);
  }
}
