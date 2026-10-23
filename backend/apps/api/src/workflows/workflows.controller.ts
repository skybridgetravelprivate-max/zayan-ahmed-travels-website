import { convertLeadToCustomer } from "../crm/convert-lead";
import { convertQuotationToBooking } from "../crm/convert-quotation";
import { BadRequestException, ConflictException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { AuditService } from "../common/audit.service";
import { AccountingService } from "../finance/accounting.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { assertBranch, assertPeopleLinks, assertPeopleLinksInBranch, assertRecordBranch, branchWhere, customerBranchWhere } from "../auth/record-scope";
import { NotifyService } from "../common/notify.service";

const UMRAH_STEPS = [
  "LEAD",
  "QUOTATION",
  "CUSTOMER_CONFIRMATION",
  "ADVANCE_PAYMENT",
  "DOCUMENTS",
  "VISA",
  "FLIGHT",
  "HOTEL",
  "TRANSPORT",
  "FINAL_PAYMENT",
  "VOUCHERS",
  "DEPARTURE",
  "COMPLETED",
];

@Controller("v1/workflows")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowsController {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
    private audit: AuditService,
    private accounting: AccountingService,
    private notify: NotifyService,
  ) {}

  @Post("leads/:id/convert-customer")
  @RequirePermission("lead.edit")
  async convertLead(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return convertLeadToCustomer(this.prisma, this.seq, this.audit, id, req.user);
  }

  @Post("quotations/:id/convert-booking")
  @RequirePermission("quotation.convert")
  async convertQuote(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.prisma.$transaction(tx => convertQuotationToBooking(tx, this.seq, this.accounting, id, req.user));
  }

  @Post("umrah-bookings/:id/advance")
  @RequirePermission("booking.approve")
  async umrahStep(
    @Param("id") id: string,
    @Body() body: { step?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    const b = await this.prisma.umrahBooking.findUnique({ where: { id } });
    if (!b) throw new BadRequestException();
    assertBranch(req.user, b.branchId);
    const step = body.step && UMRAH_STEPS.includes(body.step) ? body.step : "ADVANCE_PAYMENT";
    let status = b.status;
    if (step === "CUSTOMER_CONFIRMATION") status = "CONFIRMED";
    if (step === "DEPARTURE") status = "TRAVELING";
    if (step === "COMPLETED") status = "COMPLETED";
    if (["VISA", "FLIGHT", "HOTEL", "TRANSPORT", "DOCUMENTS"].includes(step)) status = "PROCESSING";
    if (step === "VOUCHERS") status = "READY";
    return this.prisma.umrahBooking.update({ where: { id }, data: { workflowStep: step, status } });
  }

  @Post("umrah-groups/:id/allocate")
  @RequirePermission("umrah.edit")
  async allocateSeats(@Param("id") id: string, @Body() body: { seats: number }, @Req() req: Request & { user: AuthUser }) {
    if (typeof body.seats !== "number" || !Number.isSafeInteger(body.seats) || body.seats <= 0) throw new BadRequestException("Seats must be a positive integer");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "UmrahGroup" WHERE id = ${id} FOR UPDATE`;
      const g = await tx.umrahGroup.findUnique({ where: { id } });
      if (!g) throw new NotFoundException();
      assertBranch(req.user, g.branchId);
      const next = g.reservedSeats + body.seats;
      if (g.reservedSeats < 0 || !Number.isSafeInteger(next) || next > g.totalSeats) throw new BadRequestException("Overselling seats is not allowed");
      const row = await tx.umrahGroup.update({ where: { id }, data: { reservedSeats: next } });
      await this.audit.log({ db: tx, userId: req.user.id, action: "ALLOCATE_SEATS", entity: "UmrahGroup", entityId: id, after: { seats: body.seats, reservedSeats: next } });
      return row;
    });
  }

  @Post("tickets")
  @RequirePermission("ticket.create")
  async sellTicket(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: AuthUser },
  ) {
    const allowed = new Set("ticketNumber customerId passengerId pnrId airlineId flightNumber sector departureAt arrivalAt fare tax commission discount net cost paidAmount cabin baggage currency exchangeRate agentId branchId supplierId groupId".split(" "));
    if (!body || Object.keys(body).some(key => !allowed.has(key) || (body[key] !== null && !["string", "number"].includes(typeof body[key])))) throw new BadRequestException("Unsupported ticket field");
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string" && (value.length > 300 || (key.endsWith("Id") && !/^[A-Za-z0-9_-]{1,80}$/.test(value)))) throw new BadRequestException("Invalid ticket field");
    }
    return this.prisma.$transaction(async tx => {
      assertBranch(req.user, body.branchId || req.user.defaultBranchId);
      await assertPeopleLinks(tx, req.user, body);
      await assertPeopleLinksInBranch(tx, body, body.branchId || req.user.defaultBranchId);
      const net = Number(body.net ?? Number(body.fare ?? 0) + Number(body.tax ?? 0) - Number(body.discount ?? 0));
      const cost = Number(body.cost ?? 0);
      const profit = net - cost;
      const paidAmount = Number(body.paidAmount ?? 0);
      if (![net, cost, paidAmount, Number(body.fare ?? 0), Number(body.tax ?? 0), Number(body.discount ?? 0)].every(n => Number.isFinite(n) && n >= 0) || paidAmount > net) throw new BadRequestException("Invalid ticket amounts");
      const ticket = await tx.ticketSale.create({
        data: {
          ...body,
          net,
          profit,
          paidAmount,
          branchId: (body.branchId as string) || req.user.defaultBranchId,
          paymentStatus: paidAmount >= net && net > 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID",
          status: "ISSUED",
        } as never,
      });
      const ar = await this.accounting.accountByCode("1300", tx);
      const rev = await this.accounting.accountByCode("4200", tx);
      const cogs = await this.accounting.accountByCode("5100", tx);
      const ap = await this.accounting.accountByCode("2100", tx);
      if (net > 0) {
        await this.accounting.postJournal({
          db: tx,
          date: new Date(),
          memo: `Ticket ${ticket.ticketNumber ?? ticket.id}`,
          branchId: ticket.branchId,
          userId: req.user.id,
          kind: "SALE",
          module: "ticket",
          sourceId: ticket.id,
          lines: [
            { accountId: ar.id, debit: net, credit: 0, partyType: "customer", partyId: ticket.customerId ?? undefined },
            { accountId: rev.id, debit: 0, credit: net },
          ],
        });
      }
      if (cost > 0) {
        await this.accounting.postJournal({
          db: tx,
          date: new Date(),
          memo: `Ticket cost ${ticket.id}`,
          branchId: ticket.branchId,
          userId: req.user.id,
          kind: "COST",
          module: "ticket",
          sourceId: ticket.id,
          lines: [
            { accountId: cogs.id, debit: cost, credit: 0 },
            { accountId: ap.id, debit: 0, credit: cost, partyType: "supplier", partyId: ticket.supplierId ?? undefined },
          ],
        });
      }
      await this.audit.log({ db: tx, userId: req.user.id, action: "CREATE", entity: "ticketSale", entityId: ticket.id });
      return ticket;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  @Post("tickets/:id/refund")
  @RequirePermission("ticket.refund")
  async refund(
    @Param("id") id: string,
    @Body() body: { refundAmount: number; airlineDeduction?: number; agencyDeduction?: number; otherCharges?: number; reason?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize availability checks across processes until commit.
      await tx.$queryRaw`SELECT id FROM "TicketSale" WHERE id = ${id} FOR UPDATE`;
      const ticket = await tx.ticketSale.findUnique({ where: { id }, include: { refunds: true } });
      if (!ticket) throw new BadRequestException("Ticket not found");
      assertBranch(req.user, ticket.branchId);
      if (ticket.status === "CANCELLED") throw new BadRequestException("Cancelled ticket cannot be refunded");
      if (!String(body.reason ?? "").trim()) throw new BadRequestException("Refund reason is required");
      const prior = (ticket.refunds || []).reduce((sum, r) => sum.plus(r.netRefund), new Prisma.Decimal(0)).toNumber();
      const paid = ticket.paymentStatus === "UNPAID" ? 0 : Number(ticket.paidAmount ?? 0) || (ticket.paymentStatus === "PAID" ? Number(ticket.net) : Number(ticket.paidAmount ?? 0));
      const refundable = Math.max(0, new Prisma.Decimal(Math.min(paid, Number(ticket.net))).minus(prior).toNumber());
      const amounts = [body.refundAmount, body.airlineDeduction ?? 0, body.agencyDeduction ?? 0, body.otherCharges ?? 0];
      if (!amounts.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && new Prisma.Decimal(value).decimalPlaces() <= 2)) throw new BadRequestException("Refund amounts must be nonnegative numbers with at most two decimal places");
      const netRefund = amounts.slice(1).reduce((amount, deduction) => amount.minus(deduction), new Prisma.Decimal(body.refundAmount)).toNumber();
      if (Number(body.refundAmount) <= 0) throw new BadRequestException("Refund amount is required");
      if (netRefund <= 0) throw new BadRequestException("Net refund after deductions must be positive");
      if (netRefund > refundable) throw new BadRequestException("Refund cannot exceed refundable amount");
      const journal = await this.accounting.postRefund({
        userId: req.user.id,
        amount: netRefund,
        module: "ticket",
        sourceId: ticket.id,
        customerId: ticket.customerId,
        branchId: ticket.branchId,
        memo: `Ticket refund ${ticket.ticketNumber}`,
        db: tx,
      });
      const refund = await tx.ticketRefund.create({
        data: {
          ticketId: id,
          originalFare: ticket.fare,
          refundAmount: body.refundAmount,
          airlineDeduction: body.airlineDeduction ?? 0,
          agencyDeduction: body.agencyDeduction ?? 0,
          otherCharges: body.otherCharges ?? 0,
          netRefund,
          reason: body.reason,
          approvedById: req.user.id,
          journalId: journal.id,
        },
      });
      await tx.ticketSale.update({
        where: { id },
        data: {
          status: netRefund >= refundable - 0.009 ? "REFUNDED" : ticket.status,
          paymentStatus: prior + netRefund >= paid - 0.009 && paid > 0 ? "REFUNDED" : ticket.paymentStatus,
        },
      });
      await this.audit.log({ userId: req.user.id, action: "REFUND", entity: "ticketSale", entityId: id, after: refund, db: tx });
      return refund;
    });
  }

  @Post("tickets/:id/reissue")
  @RequirePermission("ticket.reissue")
  async reissue(
    @Param("id") id: string,
    @Body() body: {
      newItinerary?: string;
      airlineChangeFee?: number;
      agencyFee?: number;
      fareDifference?: number;
      reason?: string;
      newTicketNumber?: string;
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "TicketSale" WHERE id = ${id} FOR UPDATE`;
    const original = await tx.ticketSale.findUnique({ where: { id } });
    if (!original) throw new BadRequestException();
    assertBranch(req.user, original.branchId);
    await assertPeopleLinks(tx, req.user, original);
    if (["REISSUED", "REFUNDED", "CANCELLED"].includes(original.status)) throw new ConflictException("Ticket cannot be reissued in its current state");
    const fees = [body.airlineChangeFee ?? 0, body.agencyFee ?? 0, body.fareDifference ?? 0];
    if (!fees.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && new Prisma.Decimal(value).decimalPlaces() <= 2)) throw new BadRequestException("Fees must be nonnegative amounts with at most two decimal places");
    const extra = Number(body.airlineChangeFee ?? 0) + Number(body.agencyFee ?? 0) + Number(body.fareDifference ?? 0);
    const newTicket = await tx.ticketSale.create({
      data: {
        customerId: original.customerId,
        passengerId: original.passengerId,
        airlineId: original.airlineId,
        branchId: original.branchId,
        agentId: original.agentId,
        ticketNumber: body.newTicketNumber,
        sector: original.sector,
        fare: Number(original.fare) + Number(body.fareDifference ?? 0),
        tax: original.tax,
        net: Number(original.net) + extra,
        cost: original.cost,
        profit: Number(original.profit) + extra,
        currency: original.currency,
        status: "ISSUED",
        paymentStatus: extra > 0 ? "PARTIAL" : original.paymentStatus,
      },
    });
    let journalId: string | undefined;
    if (extra > 0) {
      const ar = await this.accounting.accountByCode("1300", tx);
      const rev = await this.accounting.accountByCode("4200", tx);
      const journal = await this.accounting.postJournal({
        db: tx,
        date: new Date(),
        memo: `Ticket reissue ${original.ticketNumber}`,
        kind: "REISSUE",
        module: "ticket",
        sourceId: newTicket.id,
        branchId: original.branchId,
        userId: req.user.id,
        lines: [
          { accountId: ar.id, debit: extra, credit: 0 },
          { accountId: rev.id, debit: 0, credit: extra },
        ],
      });
      journalId = journal.id;
    }
    const row = await tx.ticketReissue.create({
      data: {
        journalId,
        originalTicketId: original.id,
        newTicketId: newTicket.id,
        oldItinerary: original.sector,
        newItinerary: body.newItinerary,
        airlineChangeFee: body.airlineChangeFee ?? 0,
        agencyFee: body.agencyFee ?? 0,
        fareDifference: body.fareDifference ?? 0,
        totalAdditional: extra,
        reason: body.reason,
      },
    });
    await tx.ticketSale.update({ where: { id: original.id }, data: { status: "REISSUED" } });
    await this.audit.log({ db: tx, userId: req.user.id, action: "REISSUE", entity: "ticketSale", entityId: id, after: { reissueId: row.id, newTicketId: newTicket.id } });
    return { reissue: row, newTicket };
    });
  }

  @Post("hotel-inventory/allocate")
  @RequirePermission("hotel.inventory")
  async allocateInventory(
    @Body() body: { roomTypeId: string; date: string; rooms: number; kind?: "UMRAH_SALE" | "LOCAL_SALE" | "PRIVATE" | "OUTSOURCE" },
  ) {
    const date = new Date(body.date);
    date.setHours(0, 0, 0, 0);
    const kind = body.kind ?? "UMRAH_SALE";
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.hotelRoomType.findUnique({ where: { id: body.roomTypeId } });
      if (!room) throw new BadRequestException("Room type not found");
      let day = await tx.hotelInventoryDay.findUnique({
        where: { roomTypeId_date_kind: { roomTypeId: body.roomTypeId, date, kind } },
      });
      if (!day) {
        day = await tx.hotelInventoryDay.create({
          data: { roomTypeId: body.roomTypeId, date, kind, total: room.totalInventory, booked: 0, blocked: 0 },
        });
      }
      const available = day.total - day.booked - day.blocked;
      if (body.rooms > available) throw new BadRequestException("Insufficient hotel inventory");
      const booked = day.booked + body.rooms;
      const remaining = day.total - booked - day.blocked;
      return tx.hotelInventoryDay.update({
        where: { id: day.id },
        data: {
          booked,
          status: remaining <= 0 ? "SOLD_OUT" : booked > 0 ? "RESERVED" : "AVAILABLE",
        },
      });
    });
  }

  @Get("hotel-inventory/calendar")
  @RequirePermission("hotel.inventory")
  async calendar(@Query() q: { hotelId: string; from: string; to: string }) {
    const rooms = await this.prisma.hotelRoomType.findMany({
      where: { hotelId: q.hotelId },
      include: {
        days: { where: { date: { gte: new Date(q.from), lte: new Date(q.to) } } },
      },
    });
    return rooms;
  }

  @Post("payroll/run")
  @RequirePermission("hr.create")
  async payroll(@Body() body: { period: string }) {
    const employees = await this.prisma.employee.findMany({ where: { status: "ACTIVE" } });
    const run = await this.prisma.payrollRun.create({ data: { period: body.period, status: "POSTED" } });
    const slips = [];
    for (const e of employees) {
      const slipNo = await this.seq.next("sal", "ZAT-SAL");
      const net = Number(e.basicSalary);
      slips.push(
        await this.prisma.salarySlip.create({
          data: { slipNo, payrollId: run.id, employeeId: e.id, basic: e.basicSalary, net },
        }),
      );
    }
    return { run, slips };
  }

  @Post("star")
  @RequirePermission("star.create")
  async createStar(
    @Body() body: {
      customerId?: string;
      supplierId?: string;
      groupName?: string;
      status?: string;
      autoAllocate?: boolean;
      rooms?: Array<{
        hotelId: string; roomType: string; roomNo?: string; qty?: number;
        checkIn: string; checkOut: string; mealPlan?: string; cost?: number; sale?: number;
        passengerIds?: string[];
      }>;
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    assertBranch(req.user, req.user.defaultBranchId);
    await assertPeopleLinks(this.prisma, req.user, body);
    for (const room of body.rooms || []) await assertPeopleLinks(this.prisma, req.user, room);
    const rooms = (body.rooms || []).map((rm, i) => ({
      ...rm,
      roomNo: rm.roomNo || (body.autoAllocate === false ? undefined : `${String(rm.hotelId).slice(-4)}-${i + 1}`),
    }));
    if (!rooms.length) throw new BadRequestException("Add at least one hotel room");
    for (const rm of rooms) {
      if (new Date(rm.checkOut) <= new Date(rm.checkIn)) throw new BadRequestException("Check-out must be after check-in");
      await this.assertStarRoomFree({
        hotelId: rm.hotelId,
        roomNo: rm.roomNo,
        checkIn: new Date(rm.checkIn),
        checkOut: new Date(rm.checkOut),
      });
    }
    const cost = rooms.reduce((s, r) => s + Number(r.cost || 0) * Number(r.qty || 1), 0);
    const sellingPrice = rooms.reduce((s, r) => s + Number(r.sale || 0) * Number(r.qty || 1), 0);
    const bookingNumber = await this.seq.next("str", "STR");
    const rec = await this.prisma.starBooking.create({
      data: {
        bookingNumber,
        customerId: body.customerId,
        supplierId: body.supplierId,
        groupName: body.groupName,
        status: body.status || "Tentative Request",
        autoAllocate: body.autoAllocate !== false,
        cost,
        sellingPrice,
        profit: sellingPrice - cost,
        branchId: req.user.defaultBranchId,
        rooms: {
          create: rooms.map((rm) => ({
            hotelId: rm.hotelId,
            roomType: rm.roomType,
            roomNo: rm.roomNo,
            qty: rm.qty || 1,
            checkIn: new Date(rm.checkIn),
            checkOut: new Date(rm.checkOut),
            mealPlan: rm.mealPlan,
            cost: rm.cost || 0,
            sale: rm.sale || 0,
            pax: { create: (rm.passengerIds || []).map((passengerId) => ({ passengerId })) },
          })),
        },
      },
      include: { rooms: { include: { pax: true } } },
    });
    await this.accounting.postSale({
      userId: req.user.id,
      module: "star",
      sourceId: rec.id,
      amount: sellingPrice,
      customerId: rec.customerId,
      branchId: rec.branchId,
      memo: `STAR ${rec.bookingNumber}`,
    });
    await this.accounting.postCost({
      userId: req.user.id,
      module: "star",
      sourceId: rec.id,
      amount: cost,
      supplierId: rec.supplierId,
      branchId: rec.branchId,
      memo: `STAR cost ${rec.bookingNumber}`,
    });
    await this.audit.log({ userId: req.user.id, action: "CREATE", entity: "starBooking", entityId: rec.id, after: rec });
    return rec;
  }

  @Get("star")
  @RequirePermission("star.view")
  async listStar(@Query() q: { q?: string; status?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.prisma.starBooking.findMany({
      where: {
        ...branchWhere(req.user),
        ...(q.status ? { status: q.status } : {}),
        ...(q.q
          ? {
              OR: [
                { bookingNumber: { contains: q.q, mode: "insensitive" } },
                { groupName: { contains: q.q, mode: "insensitive" } },
                { groupCode: { contains: q.q, mode: "insensitive" } },
                { confirmationNo: { contains: q.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { customer: true, supplier: true, rooms: { include: { hotel: true, pax: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("star/intimation")
  @RequirePermission("star.view")
  async starIntimation(@Query() q: { from?: string; to?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.prisma.starBooking.findMany({
      where: {
        ...branchWhere(req.user),
        status: { notIn: ["Cancelled", "Expired"] },
        ...(q.from || q.to ? { rooms: { some: { checkIn: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } } } } : {}),
      },
      include: { customer: true, rooms: { include: { hotel: true, pax: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  @Get("star/:id")
  @RequirePermission("star.view")
  async getStar(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    const rec = await this.prisma.starBooking.findUnique({
      where: { id },
      include: { customer: true, supplier: true, rooms: { include: { hotel: true, pax: { include: { passenger: true } } } } },
    });
    if (!rec) throw new NotFoundException("STAR booking not found");
    assertBranch(req.user, rec.branchId);
    await assertPeopleLinks(this.prisma, req.user, rec);
    return rec;
  }

  @Post("star/:id/allocate")
  @RequirePermission("star.allocate")
  async allocateStar(
    @Param("id") id: string,
    @Body() body: { rooms?: Array<{ id: string; roomNo?: string; passengerIds?: string[]; status?: string }> },
    @Req() req: Request & { user: AuthUser },
  ) {
    const booking = await this.prisma.starBooking.findUnique({
      where: { id },
      include: { rooms: true },
    });
    if (!booking) throw new NotFoundException("STAR booking not found");
    assertBranch(req.user, booking.branchId);
    for (const room of body.rooms || []) await assertPeopleLinks(this.prisma, req.user, room);
    const updates = body.rooms || [];
    for (const rm of updates) {
      const current = booking.rooms.find((r) => r.id === rm.id);
      if (!current) throw new BadRequestException("Room does not belong to this STAR booking");
      await this.assertStarRoomFree({
        hotelId: current.hotelId,
        roomNo: rm.roomNo ?? current.roomNo,
        checkIn: current.checkIn,
        checkOut: current.checkOut,
        excludeBookingId: id,
        excludeRoomId: rm.id,
      });
    }
    const rec = await this.prisma.$transaction(async (tx) => {
      for (const rm of updates) {
        await tx.starBookingRoomPax.deleteMany({ where: { roomId: rm.id } });
        await tx.starBookingRoom.update({
          where: { id: rm.id },
          data: {
            roomNo: rm.roomNo,
            status: rm.status || "ALLOCATED",
            pax: { create: (rm.passengerIds || []).map((passengerId) => ({ passengerId })) },
          },
        });
      }
      return tx.starBooking.findUnique({
        where: { id },
        include: { rooms: { include: { hotel: true, pax: true } } },
      });
    });
    await this.audit.log({ userId: req.user.id, action: "ALLOCATE", entity: "starBooking", entityId: id, after: rec });
    return rec;
  }

  @Post("transport")
  @RequirePermission("transport.create")
  async sellTransport(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.prisma.$transaction(async tx => {
      assertBranch(req.user, body.branchId || req.user.defaultBranchId);
      await assertPeopleLinks(tx, req.user, body);
      await assertPeopleLinksInBranch(tx, body, body.branchId || req.user.defaultBranchId);
      for (const [field, model] of [["umrahBookingId", "umrahBooking"], ["hotelBookingId", "hotelBooking"]] as const) if (body[field]) await assertRecordBranch(tx, req.user, model, body[field]);
      const paxCount = Number(body.paxCount ?? 1);
      if (!Number.isFinite(paxCount) || paxCount < 1) throw new BadRequestException("Passenger count must be at least 1");
      const cost = Number(body.cost ?? 0);
      const sellingPrice = Number(body.sellingPrice ?? 0);
      if (![cost, sellingPrice].every(n => Number.isFinite(n) && n >= 0)) throw new BadRequestException("Financial totals cannot be negative or invalid");
      const paid = Number(body.paid ?? 0);
      if (!Number.isFinite(paid) || paid < 0) throw new BadRequestException("Invalid paid amount");
      if (paid - sellingPrice > 0.5) throw new BadRequestException("Paid amount exceeds selling total");
      const tripDate = body.tripDate ? new Date(String(body.tripDate)) : new Date();
      const bookingNumber = String(body.bookingNumber || (await this.seq.next("tr-bk", "TRN", tx)));
      const rec = await tx.transportBooking.create({
        data: {
          bookingNumber,
          customerId: (body.customerId as string) || null,
          passengerId: (body.passengerId as string) || null,
          vehicleId: (body.vehicleId as string) || null,
          driverId: (body.driverId as string) || null,
          vehicleType: (body.vehicleType as string) || null,
          driverName: (body.driverName as string) || null,
          driverContact: (body.driverContact as string) || null,
          pickup: (body.pickup as string) || null,
          dropoff: (body.dropoff as string) || null,
          route: (body.route as string) || null,
          tripDate,
          tripTime: (body.tripTime as string) || null,
          paxCount,
          cost,
          sellingPrice,
          net: sellingPrice - cost,
          paid,
          paymentStatus: paid >= sellingPrice && sellingPrice > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          umrahBookingId: (body.umrahBookingId as string) || null,
          hotelBookingId: (body.hotelBookingId as string) || null,
          branchId: (body.branchId as string) || req.user.defaultBranchId,
          status: String(body.status || "Reserved"),
        },
      });
      const voucherNo = await this.seq.next("tr-v", "VCH", tx);
      await tx.transportVoucher.create({ data: { voucherNo, bookingId: rec.id } });
      await this.accounting.postSale({
        db: tx,
        userId: req.user.id,
        module: "transport",
        sourceId: rec.id,
        amount: sellingPrice,
        customerId: rec.customerId,
        branchId: rec.branchId,
        date: tripDate,
        memo: `Transport ${rec.bookingNumber}`,
      });
      await this.accounting.postCost({
        db: tx,
        userId: req.user.id,
        module: "transport",
        sourceId: rec.id,
        amount: cost,
        branchId: rec.branchId,
        date: tripDate,
        memo: `Transport cost ${rec.bookingNumber}`,
      });
      await this.audit.log({ db: tx, userId: req.user.id, action: "CREATE", entity: "transportBooking", entityId: rec.id, after: rec });
      return rec;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  @Get("transport/intimation")
  @RequirePermission("transport.view")
  async transportIntimation(@Query() q: { from?: string; to?: string; supplierId?: string }, @Req() req: Request & { user: AuthUser }) {
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    return this.prisma.transportBooking.findMany({
      where: {
        ...branchWhere(req.user),
        status: { not: "Cancelled" },
        ...(from || to ? { tripDate: { gte: from, lte: to } } : {}),
      },
      include: { customer: true, vehicle: true, driver: true, umrahBooking: true, hotelBooking: true },
      orderBy: { tripDate: "asc" },
    });
  }

  @Post("passengers/expiry-alerts")
  @RequirePermission("passenger.view")
  async expiryAlerts(@Req() req: Request & { user: AuthUser }) {
    const soon = new Date();
    soon.setDate(soon.getDate() + 90);
    const pax = await this.prisma.passenger.findMany({
      where: { ...(req.user.isSuperAdmin ? {} : { customer: customerBranchWhere(req.user) }), passportExpiryDate: { lte: soon, gte: new Date() } },
    });
    for (const p of pax) {
      await this.notify.send(req.user.id, "Passport expiry", `${p.fullName} passport expires ${p.passportExpiryDate?.toISOString().slice(0, 10)}`, "ALERT", {
        passengerId: p.id,
      });
    }
    return { count: pax.length };
  }

  private async assertStarRoomFree(opts: {
    hotelId: string;
    roomNo?: string | null;
    checkIn: Date;
    checkOut: Date;
    excludeBookingId?: string;
    excludeRoomId?: string;
  }) {
    const roomNo = String(opts.roomNo || "").trim();
    if (!roomNo) return;
    const starClash = await this.prisma.starBookingRoom.findFirst({
      where: {
        hotelId: opts.hotelId,
        roomNo,
        id: opts.excludeRoomId ? { not: opts.excludeRoomId } : undefined,
        bookingId: opts.excludeBookingId ? { not: opts.excludeBookingId } : undefined,
        booking: { status: { notIn: ["Cancelled", "Expired"] } },
        checkIn: { lt: opts.checkOut },
        checkOut: { gt: opts.checkIn },
      },
    });
    if (starClash) throw new BadRequestException(`Room ${roomNo} is already allocated on another STAR booking`);
    const stayClash = await this.prisma.hotelStayRoom.findFirst({
      where: {
        roomNumber: roomNo,
        status: { notIn: ["CANCELLED"] },
        segment: {
          hotelId: opts.hotelId,
          checkIn: { lt: opts.checkOut },
          checkOut: { gt: opts.checkIn },
          booking: { cancelledAt: null },
        },
      },
    });
    if (stayClash) throw new BadRequestException(`Room ${roomNo} is already occupied on a Reservation stay`);
  }
}
