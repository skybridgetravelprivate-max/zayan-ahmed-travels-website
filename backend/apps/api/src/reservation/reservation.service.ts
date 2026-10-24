import { ReceiptOperations } from "../finance/receipt-operations";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AuthUser, assertCan } from "../auth/auth.types";
import { assertBranch, assertPeopleLinks, assertPeopleLinksInBranch, branchWhere } from "../auth/record-scope";
import { AccountingService } from "../finance/accounting.service";
import { assertHotelRoomLinks } from "./hotel-links";

export type StayRoomInput = {
  id?: string;
  roomTypeId?: string;
  hotelRoomId?: string;
  roomNumber?: string;
  occupancy?: number;
  status?: string;
  passengerIds?: string[];
  supplierCost?: number;
  sellingPrice?: number;
  discount?: number;
  tax?: number;
  commission?: number;
};

export type StaySegmentInput = {
  hotelId: string;
  supplierId?: string;
  checkIn: string;
  checkOut: string;
  confirmationNo?: string;
  status?: string;
  notes?: string;
  specialRequest?: string;
  rooms: StayRoomInput[];
};

export type ReservationInput = {
  id?: string;
  kind?: string;
  customerId?: string;
  passengerId?: string;
  hotelId?: string;
  checkIn?: string;
  checkOut?: string;
  supplierId?: string;
  agentId?: string;
  branchId?: string;
  notes?: string;
  specialRequests?: string;
  paid?: number;
  paymentMethod?: string;
  segments: StaySegmentInput[];
};

const money = (n: number) => new Prisma.Decimal(Number(n || 0).toFixed(2));

export function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.round(ms / 86400000);
}

export function datesOverlap(aIn: Date, aOut: Date, bIn: Date, bOut: Date) {
  return aIn < bOut && bIn < aOut;
}

@Injectable()
export class ReservationService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private accounting: AccountingService,
  ) {}

  private totals(segments: StaySegmentInput[]) {
    let cost = 0;
    let selling = 0;
    let discount = 0;
    let tax = 0;
    let commission = 0;
    let rooms = 0;
    for (const seg of segments) {
      for (const rm of seg.rooms || []) {
        rooms += 1;
        cost += Number(rm.supplierCost || 0);
        selling += Number(rm.sellingPrice || 0);
        discount += Number(rm.discount || 0);
        tax += Number(rm.tax || 0);
        commission += Number(rm.commission || 0);
      }
    }
    const net = selling - discount + tax;
    const profit = net - cost - commission;
    return { cost, selling, discount, tax, commission, net, profit, rooms };
  }

  private validateGraph(input: ReservationInput) {
    if (!input.segments?.length) throw new BadRequestException("Add at least one hotel stay.");
    const seenConf = new Set<string>();
    for (const seg of input.segments) {
      const cin = new Date(seg.checkIn);
      const cout = new Date(seg.checkOut);
      if (!(cout > cin)) throw new BadRequestException("Check-out must be after check-in.");
      if (!seg.hotelId) throw new BadRequestException("Hotel is required on each stay.");
      if (!seg.rooms?.length) throw new BadRequestException("Each hotel stay needs at least one room.");
      const conf = String(seg.confirmationNo || "").trim().toLowerCase();
      if (conf) {
        if (seenConf.has(conf)) throw new BadRequestException("Duplicate confirmation number.");
        seenConf.add(conf);
      }
      const assigned = new Set<string>();
      for (const rm of seg.rooms) {
        const occ = (rm.passengerIds || []).length;
        const cap = Number(rm.occupancy || 4);
        if (occ > cap) throw new BadRequestException("Room occupancy exceeds capacity.");
        for (const pid of rm.passengerIds || []) {
          const k = `${seg.hotelId}:${pid}`;
          if (assigned.has(k)) throw new BadRequestException("A guest cannot be assigned twice in the same hotel.");
          assigned.add(k);
        }
      }
    }
  }

  async occupancyConflicts(
    excludeBookingId: string | undefined,
    segments: StaySegmentInput[],
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const conflicts: string[] = [];
    // Shared physical rooms are serialized across processes when called inside save's transaction.
    // Use one hotel identity so a physical-room ID and its displayed number cannot use different locks.
    const keys = [...new Set(segments.filter(seg => seg.rooms.some(room => room.hotelRoomId || room.roomNumber))
      .map(seg => `hotel-occupancy:${seg.hotelId}`))].sort();
    for (const key of keys) await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 2))::text`;
    for (const seg of segments) {
      const cin = new Date(seg.checkIn);
      const cout = new Date(seg.checkOut);
      for (const rm of seg.rooms) {
        if (!rm.hotelRoomId && !rm.roomNumber) continue;
        const others = await db.hotelStayRoom.findMany({
          where: {
            status: { notIn: ["CHECKED_OUT", "TRANSFERRED", "CANCELLED"] },
            hotelRoomId: rm.hotelRoomId || undefined,
            roomNumber: rm.hotelRoomId ? undefined : rm.roomNumber || undefined,
            segment: {
              hotelId: seg.hotelId,
              booking: { cancelledAt: null, id: excludeBookingId ? { not: excludeBookingId } : undefined },
            },
          },
          include: { segment: { include: { booking: true } } },
        });
        for (const o of others) {
          if (!datesOverlap(cin, cout, o.segment.checkIn, o.segment.checkOut)) continue;
          if (rm.hotelRoomId && o.hotelRoomId && rm.hotelRoomId === o.hotelRoomId) {
            conflicts.push(`Physical room already allocated on ${o.segment.booking.bookingNumber}.`);
          } else if (!rm.hotelRoomId && rm.roomNumber && o.roomNumber === rm.roomNumber) {
            conflicts.push(`Room ${rm.roomNumber} already allocated on ${o.segment.booking.bookingNumber}.`);
          }
        }
      }
    }
    if (conflicts.length) throw new BadRequestException(conflicts[0]);
  }

  async save(user: AuthUser, input: ReservationInput, ip?: string, transaction?: Prisma.TransactionClient, requestKey?: string): Promise<Awaited<ReturnType<ReservationService["get"]>>> {
    if (!input.id && Number(input.paid ?? 0) !== 0) {
      const result = await new ReceiptOperations(this.prisma, this.seq, this.audit, this.accounting).initial(user, { ...input }, requestKey, "hotelBookingId", input.paid,
        tx => this.save(user, { ...input, paid: 0, paymentMethod: undefined }, ip, tx));
      return this.get(user, result.id);
    }
    assertCan(user, "hotel.booking");
    this.validateGraph(input);
    const tot = this.totals(input.segments);
    const paid = Number(input.paid || 0);
    if (paid - tot.net > 0.5) throw new BadRequestException("Paid amount exceeds selling total.");
    if (tot.cost < 0 || tot.net < 0) throw new BadRequestException("Financial totals cannot be negative.");
    const first = input.segments[0];
    const checkIn = new Date(first.checkIn);
    const checkOut = new Date(input.segments[input.segments.length - 1].checkOut);
    const nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) throw new BadRequestException("Invalid stay dates.");

    const persistSegments = async (bookingId: string, db: Prisma.TransactionClient) => {
      await db.hotelStaySegment.deleteMany({ where: { bookingId } });
      for (const seg of input.segments) {
        const cin = new Date(seg.checkIn);
        const cout = new Date(seg.checkOut);
        await db.hotelStaySegment.create({
          data: {
            bookingId,
            hotelId: seg.hotelId,
            supplierId: seg.supplierId || null,
            checkIn: cin,
            checkOut: cout,
            nights: nightsBetween(cin, cout),
            confirmationNo: seg.confirmationNo || null,
            status: seg.status || "Pending",
            notes: seg.notes || null,
            specialRequest: seg.specialRequest || null,
            rooms: {
              create: (seg.rooms || []).map((rm) => ({
                roomTypeId: rm.roomTypeId || null,
                hotelRoomId: rm.hotelRoomId || null,
                roomNumber: rm.roomNumber || null,
                occupancy: rm.occupancy || 2,
                status: rm.status || ((rm.passengerIds || []).length ? "ALLOCATED" : "VACANT"),
                supplierCost: money(rm.supplierCost || 0),
                sellingPrice: money(rm.sellingPrice || 0),
                discount: money(rm.discount || 0),
                tax: money(rm.tax || 0),
                commission: money(rm.commission || 0),
                pax: {
                  create: (rm.passengerIds || []).map((passengerId) => ({ passengerId })),
                },
              })),
            },
          },
        });
      }
    };

    const persistBooking = async (tx: Prisma.TransactionClient) => {
        for (const segment of input.segments) for (const room of segment.rooms) await assertHotelRoomLinks(tx, { ...room, hotelId: segment.hotelId });
        if (input.id) {
          await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${input.id} FOR UPDATE`;
          const existing = await tx.hotelBooking.findUnique({ where: { id: input.id }, include: { staySegments: { include: { rooms: true } } } });
          if (!existing) throw new NotFoundException();
          assertBranch(user, existing.branchId);
          if (existing.staySegments?.some(segment => segment.rooms.some(room => room.checkinAt || ["CHECKED_IN", "CHECKED_OUT"].includes(room.status)))) throw new BadRequestException("A started stay cannot be replaced through reservation editing.");
          // These totals and parties already own posted sale/cost entries.
          const updatePaid = input.paid === undefined ? Number(existing.paid) : paid;
          const financial = { cost: tot.cost, sellingPrice: tot.selling, discount: tot.discount, tax: tot.tax, commission: tot.commission, net: tot.net, paid: updatePaid };
          if (Object.entries(financial).some(([key, value]) => !money(value).equals(existing[key as keyof typeof existing] as Prisma.Decimal)) ||
              (input.customerId || existing.customerId) !== existing.customerId ||
              (input.passengerId || existing.passengerId) !== existing.passengerId ||
              (input.supplierId || first.supplierId || existing.supplierId) !== existing.supplierId ||
              (input.branchId || existing.branchId) !== existing.branchId ||
              (input.agentId || existing.agentId) !== existing.agentId) {
            throw new BadRequestException("Posted reservation amounts and parties cannot be changed.");
          }
          if (existing.cancelledAt) throw new BadRequestException("Reservation is cancelled.");
          await assertPeopleLinks(tx, user, input);
          for (const segment of input.segments) for (const room of segment.rooms) await assertPeopleLinks(tx, user, room);
          await this.occupancyConflicts(input.id, input.segments, tx);
          const row = await tx.hotelBooking.update({
            where: { id: input.id },
            data: {
              kind: input.kind || existing.kind,
              customerId: input.customerId || existing.customerId,
              passengerId: input.passengerId || existing.passengerId,
              hotelId: first.hotelId,
              checkIn,
              checkOut,
              nights,
              rooms: tot.rooms,
              cost: money(tot.cost),
              sellingPrice: money(tot.selling),
              discount: money(tot.discount),
              tax: money(tot.tax),
              commission: money(tot.commission),
              net: money(tot.net),
              paid: money(updatePaid),
              balance: money(Math.max(tot.net - updatePaid, 0)),
              supplierId: input.supplierId || first.supplierId || existing.supplierId,
              notes: input.notes,
              specialRequests: input.specialRequests,
              status: existing.status,
            },
          });
          await persistSegments(row.id, tx);
          await this.audit.log({ userId: user.id, action: "update", entity: "HotelBooking", entityId: row.id, after: row, ipAddress: ip, db: tx });
          return row.id;
        }

        assertBranch(user, input.branchId || user.defaultBranchId);
        await assertPeopleLinks(tx, user, input);
        await assertPeopleLinksInBranch(tx, input, input.branchId || user.defaultBranchId);
        for (const segment of input.segments) for (const room of segment.rooms) await assertPeopleLinks(tx, user, room);
        await this.occupancyConflicts(input.id, input.segments, tx);
        const bookingNumber = await this.seq.next("htl-bk", "HTL", tx);
        const row = await tx.hotelBooking.create({
          data: {
            bookingNumber,
            kind: input.kind || "RESERVATION",
            type: "DEFINITE",
            customerId: input.customerId,
            passengerId: input.passengerId,
            hotelId: first.hotelId,
            checkIn,
            checkOut,
            nights,
            rooms: tot.rooms,
            cost: money(tot.cost),
            sellingPrice: money(tot.selling),
            discount: money(tot.discount),
            tax: money(tot.tax),
            commission: money(tot.commission),
            net: money(tot.net),
            paid: money(paid),
            balance: money(Math.max(tot.net - paid, 0)),
            supplierId: input.supplierId || first.supplierId,
            agentId: input.agentId,
            branchId: input.branchId || user.defaultBranchId,
            notes: input.notes,
            specialRequests: input.specialRequests,
            status: "DEFINITE",
          },
        });
        await persistSegments(row.id, tx);
        await this.accounting.postSale({
          userId: user.id,
          module: "reservation",
          sourceId: row.id,
          amount: Number(tot.net),
          customerId: input.customerId,
          branchId: input.branchId || user.defaultBranchId,
          memo: `Hotel ${row.bookingNumber}`,
          db: tx,
        });
        await this.accounting.postCost({
          userId: user.id,
          module: "reservation",
          sourceId: row.id,
          amount: Number(tot.cost),
          supplierId: input.supplierId || first.supplierId,
          branchId: input.branchId,
          memo: `Hotel cost ${row.bookingNumber}`,
          db: tx,
        });
        await this.audit.log({ userId: user.id, action: "create", entity: "HotelBooking", entityId: row.id, after: row, ipAddress: ip, db: tx });
        return row.id;
      };
    const bookingId = transaction ? await persistBooking(transaction) : await this.prisma.$transaction(persistBooking, { maxWait: 10_000, timeout: 30_000 });
    return this.get(user, bookingId, transaction);
  }

  private include() {
    return {
      staySegments: { include: { rooms: { include: { pax: true, hotelRoom: true } }, hotel: true } },
      customer: true,
      hotel: true,
    } as const;
  }

  async get(user: AuthUser, id: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    assertCan(user, "hotel.booking");
    const row = await db.hotelBooking.findUnique({ where: { id }, include: this.include() });
    if (!row) throw new NotFoundException();
    assertBranch(user, row.branchId);
    return row;
  }

  async list(user: AuthUser, q: { kind?: string; status?: string; hotelId?: string; pending?: string; tentative?: string }) {
    assertCan(user, "hotel.booking");
    return this.prisma.hotelBooking.findMany({
      where: {
        ...branchWhere(user),
        kind: q.kind || undefined,
        hotelId: q.hotelId || undefined,
        cancelledAt: q.status === "CANCELLED" ? { not: null } : q.status === "ACTIVE" ? null : undefined,
        status: q.tentative === "1" ? { contains: "TENT", mode: "insensitive" } : q.pending === "1" ? { contains: "PEND", mode: "insensitive" } : undefined,
      },
      include: this.include(),
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async dashboards(user: AuthUser) {
    assertCan(user, "hotel.booking");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const active = { segment: { booking: { ...branchWhere(user), cancelledAt: null } } };
    const [voucherTotal, cancelled, inHouse, arriving, departing, vacantHint, hotelRows, preview] = await Promise.all([
      this.prisma.hotelBooking.count({ where: branchWhere(user) }),
      this.prisma.hotelBooking.count({ where: { ...branchWhere(user), cancelledAt: { not: null } } }),
      this.prisma.hotelStayRoom.count({ where: { status: "CHECKED_IN", ...active } }),
      this.prisma.hotelStayRoom.count({
        where: {
          status: { notIn: ["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "TRANSFERRED"] },
          segment: { booking: { ...branchWhere(user), cancelledAt: null }, checkIn: { gte: start, lt: end } },
        },
      }),
      this.prisma.hotelStayRoom.count({
        where: {
          status: { notIn: ["CHECKED_OUT", "CANCELLED"] },
          segment: { booking: { ...branchWhere(user), cancelledAt: null }, checkOut: { gte: start, lt: end } },
        },
      }),
      this.prisma.hotelStayRoom.count({ where: { status: "VACANT", ...active } }),
      this.prisma.hotelStayRoom.groupBy({
        by: ["status"],
        where: active,
        _count: { _all: true },
      }),
      this.prisma.hotelBooking.findMany({
        where: { ...branchWhere(user), cancelledAt: null },
        include: this.include(),
        orderBy: { checkIn: "desc" },
        take: 500,
      }),
    ]);
    void hotelRows;
    const byHotel = new Map<string, { name: string; occupied: number; arriving: number; departing: number }>();
    for (const b of preview) {
      for (const s of b.staySegments) {
        const key = s.hotelId;
        const slot = byHotel.get(key) || { name: s.hotel.name, occupied: 0, arriving: 0, departing: 0 };
        const cin = new Date(s.checkIn);
        cin.setHours(0, 0, 0, 0);
        const cout = new Date(s.checkOut);
        cout.setHours(0, 0, 0, 0);
        for (const r of s.rooms) {
          if (r.status === "CHECKED_IN") slot.occupied += 1;
          else if (cin.getTime() === start.getTime()) slot.arriving += 1;
          else if (cout.getTime() === start.getTime()) slot.departing += 1;
        }
        byHotel.set(key, slot);
      }
    }
    return {
      voucher: { total: voucherTotal, cancelled },
      reservation: { inHouse, arriving, departing, vacantHint },
      hotels: [...byHotel.entries()].map(([hotelId, v]) => ({ hotelId, ...v })),
      previewLimit: 500,
      previewCount: preview.length,
      kpiSource: "full-table-aggregates",
    };
  }

  private async roomOrThrow(user: AuthUser, id: string, db: Prisma.TransactionClient) {
    const room = await db.hotelStayRoom.findUnique({
      where: { id },
      include: { segment: { include: { booking: true } }, pax: true },
    });
    if (!room) throw new NotFoundException("Room unit not found.");
    assertBranch(user, room.segment.booking.branchId);
    if (room.segment.booking.cancelledAt) throw new BadRequestException("Reservation is cancelled.");
    return room;
  }

  async checkin(user: AuthUser, roomId: string, at?: string, roomNumber?: string, ip?: string) {
    assertCan(user, "reservation.checkin");
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.hotelStayRoom.findUnique({ where: { id: roomId }, select: { segment: { select: { bookingId: true } } } });
      if (!source) throw new NotFoundException("Room unit not found.");
      await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${source.segment.bookingId} FOR UPDATE`;
      const room = await this.roomOrThrow(user, roomId, tx);
      if (room.status === "CHECKED_OUT") throw new BadRequestException("Cannot check in a checked-out room.");
      if (room.status === "CHECKED_IN") throw new BadRequestException("Room is already checked in.");
      if (!room.pax.length) throw new BadRequestException("Assign PAX before check-in.");
      const row = await tx.hotelStayRoom.update({
        where: { id: roomId },
        data: { status: "CHECKED_IN", checkinAt: at ? new Date(at) : new Date(), roomNumber: roomNumber || room.roomNumber },
      });
      await this.audit.log({ userId: user.id, action: "checkin", entity: "HotelStayRoom", entityId: roomId, after: row, ipAddress: ip, db: tx });
      return row;
    });
  }

  async checkout(user: AuthUser, roomId: string, at?: string, ip?: string) {
    assertCan(user, "reservation.checkout");
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.hotelStayRoom.findUnique({ where: { id: roomId }, select: { segment: { select: { bookingId: true } } } });
      if (!source) throw new NotFoundException("Room unit not found.");
      await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${source.segment.bookingId} FOR UPDATE`;
      const room = await this.roomOrThrow(user, roomId, tx);
      if (room.status !== "CHECKED_IN") throw new BadRequestException("Check-in required before checkout.");
      const when = at ? new Date(at) : new Date();
      if (room.checkinAt && when < room.checkinAt) throw new BadRequestException("Checkout cannot be before check-in.");
      const row = await tx.hotelStayRoom.update({
        where: { id: roomId },
        data: { status: "CHECKED_OUT", checkoutAt: when },
      });
      await this.audit.log({ userId: user.id, action: "checkout", entity: "HotelStayRoom", entityId: roomId, after: row, ipAddress: ip, db: tx });
      return row;
    });
  }

  async transfer(user: AuthUser, fromRoomId: string, toRoomId: string | undefined, roomNumber: string | undefined, ip?: string) {
    assertCan(user, "reservation.transfer");
    if (toRoomId === fromRoomId) throw new BadRequestException("Choose a different destination room.");
    return this.prisma.$transaction(async (tx) => {
      const source = await tx.hotelStayRoom.findUnique({ where: { id: fromRoomId }, select: { segment: { select: { bookingId: true } } } });
      if (!source) throw new NotFoundException("Room unit not found.");
      await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${source.segment.bookingId} FOR UPDATE`;
      const from = await this.roomOrThrow(user, fromRoomId, tx);
      let toId = toRoomId;
      if (!toId) {
        const created = await tx.hotelStayRoom.create({
          data: {
            segmentId: from.segmentId,
            roomTypeId: from.roomTypeId,
            occupancy: from.occupancy,
            roomNumber: roomNumber || "",
            status: from.status === "CHECKED_IN" ? "CHECKED_IN" : "ALLOCATED",
            checkinAt: from.checkinAt,
            pax: { create: from.pax.map((p) => ({ passengerId: p.passengerId })) },
          },
        });
        toId = created.id;
      } else {
        const to = await this.roomOrThrow(user, toId, tx);
        if (to.segment.bookingId !== from.segment.bookingId) throw new BadRequestException("Transfer rooms within the same reservation.");
        await tx.hotelStayRoomPax.createMany({
          data: from.pax.map((p) => ({ stayRoomId: to.id, passengerId: p.passengerId })),
          skipDuplicates: true,
        });
        await tx.hotelStayRoom.update({
          where: { id: to.id },
          data: {
            roomNumber: roomNumber || to.roomNumber,
            status: to.status === "VACANT" ? (from.status === "CHECKED_IN" ? "CHECKED_IN" : "ALLOCATED") : to.status,
            checkinAt: to.checkinAt || from.checkinAt,
          },
        });
      }
      await tx.hotelStayRoomPax.deleteMany({ where: { stayRoomId: from.id } });
      await tx.hotelStayRoom.update({ where: { id: from.id }, data: { status: "TRANSFERRED" } });
      await tx.hotelStayTransfer.create({ data: { fromRoomId: from.id, toRoomId: toId, userId: user.id } });
      await this.audit.log({ userId: user.id, action: "transfer", entity: "HotelStayRoom", entityId: from.id, after: { toId }, ipAddress: ip, db: tx });
      return { fromId: from.id, toId };
    });
  }

  async cancel(user: AuthUser, bookingId: string, reason: string, ip?: string) {
    assertCan(user, "reservation.cancel");
    assertCan(user, "hotel.booking");
    if (!String(reason || "").trim()) throw new BadRequestException("Cancellation reason is required.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${bookingId} FOR UPDATE`;
      const booking = await tx.hotelBooking.findUnique({ where: { id: bookingId }, include: this.include() });
      if (!booking) throw new NotFoundException();
      assertBranch(user, booking.branchId);
      if (booking.cancelledAt) throw new BadRequestException("Already cancelled.");
      if (booking.staySegments.some(s => s.rooms.some(r => r.checkinAt || ["CHECKED_IN", "CHECKED_OUT"].includes(r.status)))) throw new BadRequestException("Cannot fully cancel a reservation after a stay has started.");
      const journals = await tx.journalEntry.findMany({
        where: { module: "reservation", sourceId: bookingId, status: "POSTED", kind: { in: ["SALE", "COST"] } }, include: { lines: true },
      });
      for (const journal of journals) {
        // Both entries remain posted so the original and offset reconcile to zero.
        await this.accounting.postJournal({
          db: tx, userId: user.id, date: new Date(), memo: `Cancellation of ${journal.entryNumber}`,
          kind: "CANCELLATION", module: "reservation", sourceId: bookingId, branchId: journal.branchId,
          lines: journal.lines.map(line => ({ accountId: line.accountId, debit: Number(line.credit), credit: Number(line.debit), partyType: line.partyType || undefined, partyId: line.partyId || undefined })),
        });
      }
      const row = await tx.hotelBooking.update({ where: { id: bookingId }, data: { cancelledAt: new Date(), cancelReason: reason.trim(), status: "CANCELLED", balance: money(-Number(booking.paid)) } });
      await this.audit.log({ userId: user.id, action: "cancel", entity: "HotelBooking", entityId: bookingId, before: booking, after: row, ipAddress: ip, db: tx });
      return row;
    });
  }

  async split(user: AuthUser, bookingId: string, roomIds: string[], ip?: string) {
    assertCan(user, "reservation.split");
    if (!roomIds?.length) throw new BadRequestException("Select at least one room to split.");
    if (new Set(roomIds).size !== roomIds.length) throw new BadRequestException("Select each room only once.");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "HotelBooking" WHERE id = ${bookingId} FOR UPDATE`;
      const booking = await this.get(user, bookingId, tx);
      if (booking.cancelledAt) throw new BadRequestException("Reservation is cancelled.");
      if (Number(booking.net) !== 0 || Number(booking.cost) !== 0 || Number(booking.paid) !== 0) throw new BadRequestException("Posted financial reservations cannot be split.");
      const ownedIds = new Set(booking.staySegments.flatMap(segment => segment.rooms.map(room => room.id)));
      if (roomIds.some(id => !ownedIds.has(id))) throw new NotFoundException("Room does not belong to this reservation");
      if (roomIds.length >= ownedIds.size) throw new BadRequestException("A split must leave at least one room in the original reservation.");
      const move = new Set(roomIds);
      if (booking.staySegments.some(segment => segment.rooms.some(room => move.has(room.id) && (room.checkinAt || ["CHECKED_IN", "CHECKED_OUT", "TRANSFERRED", "CANCELLED"].includes(room.status))))) {
        throw new BadRequestException("Rooms with an active or completed stay cannot be split.");
      }
      const childSegs: StaySegmentInput[] = [];
      for (const seg of booking.staySegments) {
        const rooms = seg.rooms.filter((r) => move.has(r.id));
        if (!rooms.length) continue;
        childSegs.push({
          hotelId: seg.hotelId,
          supplierId: seg.supplierId || undefined,
          confirmationNo: seg.confirmationNo || undefined,
          status: seg.status,
          notes: seg.notes || undefined,
          specialRequest: seg.specialRequest || undefined,
          checkIn: seg.checkIn.toISOString(),
          checkOut: seg.checkOut.toISOString(),
          rooms: rooms.map((r) => ({
            roomTypeId: r.roomTypeId || undefined,
            hotelRoomId: r.hotelRoomId || undefined,
            roomNumber: r.roomNumber || undefined,
            occupancy: r.occupancy,
            status: r.status,
            passengerIds: r.pax.map((p) => p.passengerId),
            supplierCost: Number(r.supplierCost),
            sellingPrice: Number(r.sellingPrice),
            discount: Number(r.discount),
            tax: Number(r.tax),
            commission: Number(r.commission),
          })),
        });
      }
      if (!childSegs.length) throw new BadRequestException("Selected rooms were not found on this booking.");
      // Release the selected occupancy only inside this transaction. Any creation or audit failure restores it.
      await tx.hotelStayRoom.deleteMany({ where: { id: { in: roomIds } } });
      const child = await this.save(user, {
        kind: booking.kind,
        customerId: booking.customerId || undefined,
        passengerId: booking.passengerId || undefined,
        supplierId: booking.supplierId || undefined,
        agentId: booking.agentId || undefined,
        branchId: booking.branchId || undefined,
        notes: booking.notes || undefined,
        specialRequests: booking.specialRequests || undefined,
        hotelId: childSegs[0].hotelId,
        segments: childSegs,
      }, ip, tx);
      await tx.hotelBooking.update({ where: { id: child.id }, data: { parentBookingId: bookingId } });
      await tx.hotelBooking.update({ where: { id: bookingId }, data: { rooms: ownedIds.size - roomIds.length } });
      await this.audit.log({ userId: user.id, action: "split", entity: "HotelBooking", entityId: bookingId, after: { childId: child.id }, ipAddress: ip, db: tx });
      return { parentId: bookingId, child: await this.get(user, child.id, tx) };
    }, { maxWait: 10_000, timeout: 30_000 });
  }
}
