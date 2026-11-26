import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../common/prisma.service";
import { businessDay } from "../crm/business-day";
import { resourceScope } from "../resources/resource-scope";
import { can, type AuthUser } from "../auth/auth.types";

export async function dailyOperations(db: PrismaService, user: AuthUser, now = new Date()) {
  const timeZone = (await db.companySettings.findFirst({ select: { timezone: true } }))?.timezone || "Asia/Karachi";
  const period = businessDay(timeZone, now);
  const range = { gte: period.start, lt: period.endExclusive };
  const hotel = { AND: [resourceScope(user, "hotel-bookings"), { cancelledAt: null, type: { not: "CANCELLED" } }] };
  const [checkIns, checkOuts, flights, transport] = await Promise.all([
    can(user, "reservation.view") ? db.hotelBooking.count({ where: { AND: [hotel, { checkIn: range }] } as Prisma.HotelBookingWhereInput }) : null,
    can(user, "reservation.view") ? db.hotelBooking.count({ where: { AND: [hotel, { checkOut: range }] } as Prisma.HotelBookingWhereInput }) : null,
    can(user, "ticket.view") ? db.ticketSale.count({ where: { AND: [resourceScope(user, "tickets"), { departureAt: range, status: "ISSUED" }] } }) : null,
    can(user, "transport.view") ? db.transportBooking.count({ where: { AND: [resourceScope(user, "transport-bookings"), { tripDate: range, status: { notIn: ["CANCELLED", "CANCELED"], mode: "insensitive" } }] } }) : null,
  ]);
  return { timeZone, period, scope: user.isSuperAdmin ? "All branches" : "Your authorized branches", generatedAt: now, metrics: [
    { key: "checkIns", label: "Check-ins", value: checkIns, basis: "Scheduled hotel bookings today; cancelled reservations excluded" },
    { key: "checkOuts", label: "Check-outs", value: checkOuts, basis: "Scheduled hotel bookings today; cancelled reservations excluded" },
    { key: "flights", label: "Flights", value: flights, basis: "Issued ticket records departing today; not distinct aircraft movements" },
    { key: "transport", label: "Transport", value: transport, basis: "Scheduled transport bookings today; cancelled bookings excluded" },
  ] };
}
