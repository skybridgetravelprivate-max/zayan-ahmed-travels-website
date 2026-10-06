import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { AccountingService } from "../finance/accounting.service";

function cityKey(city?: string | null, name?: string | null) {
  const blob = `${city || ""} ${name || ""}`.toLowerCase();
  if (/makkah|mecca|makka/.test(blob)) return "Makkah";
  if (/madinah|medina|madina/.test(blob)) return "Madinah";
  return (city || "Other").trim() || "Other";
}

function inRange(d: Date | null | undefined, from?: string, to?: string) {
  if (!d) return false;
  const dt = d.toISOString().slice(0, 10);
  if (from && dt < from) return false;
  if (to && dt > to) return false;
  return true;
}

const CATALOG = [
  { key: "ksa-arrival", label: "Arrival Intimation", group: "KSA Intimation" },
  { key: "ksa-departure", label: "Departure Intimation", group: "KSA Intimation" },
  { key: "makkah-checkin", label: "Makkah Checkin", group: "KSA Intimation" },
  { key: "makkah-checkout", label: "Makkah Checkout", group: "KSA Intimation" },
  { key: "madinah-checkin", label: "Madinah Checkin", group: "KSA Intimation" },
  { key: "madinah-checkout", label: "Madinah Checkout", group: "KSA Intimation" },
  { key: "approval-booking", label: "Approval Summary (Booking)", group: "Views/Analysis" },
  { key: "approval-pax", label: "Approval Summary (PAX)", group: "Views/Analysis" },
  { key: "daily-sale", label: "Daily Sale", group: "Views/Analysis" },
  { key: "occ-makkah", label: "Makkah Hotels Summary", group: "Hotel Occupancy" },
  { key: "occ-madinah", label: "Medina Hotel Summary", group: "Hotel Occupancy" },
  { key: "hotel-detail", label: "Single Hotel Detail", group: "Hotel Occupancy" },
  { key: "hotel-detail-2", label: "Single Hotel Detail 2", group: "Hotel Occupancy" },
  { key: "hotel-detail-3", label: "Single Hotel Detail 3", group: "Hotel Occupancy" },
  { key: "hotel-full", label: "Single Hotel Full Detail", group: "Hotel Occupancy" },
  { key: "receivables", label: "Accounts Receivable", group: "Financial" },
  { key: "receivables-summary", label: "Accounts Receivable Summary", group: "Financial" },
  { key: "trial-balance", label: "Trial Balance", group: "Financial" },
  { key: "profit-loss", label: "Profit/Loss", group: "Financial" },
];

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private accounting: AccountingService,
  ) {}

  catalog() {
    return CATALOG;
  }

  async run(key: string, q: Record<string, string>) {
    const page = Math.max(1, Number(q.page || 1));
    const pageSize = Math.min(200, Math.max(1, Number(q.pageSize || 50)));
    let rows: Record<string, unknown>[] = [];
    if (key.startsWith("ksa-") || key.startsWith("makkah-") || key.startsWith("madinah-")) {
      rows = await this.ksa(key, q);
    } else if (key === "occ-makkah" || key === "occ-madinah") {
      rows = await this.occupancySummary(key === "occ-makkah" ? "Makkah" : "Madinah", q);
    } else if (key.startsWith("hotel-")) {
      rows = await this.occupancyDetail(key, q);
    } else if (key === "approval-booking") {
      rows = await this.approvalBooking(q);
    } else if (key === "approval-pax") {
      rows = await this.approvalPax(q);
    } else if (key === "daily-sale") {
      rows = await this.dailySale(q);
    } else if (key === "receivables") {
      rows = await this.receivables();
    } else if (key === "receivables-summary") {
      const detail = await this.receivables();
      const amount = detail.reduce((s, r) => s + Number(r.debit || 0), 0);
      rows = [{ status: "Open", parties: detail.length, debit: amount }];
    } else if (key === "trial-balance") {
      const tb = await this.accounting.trialBalance(q.to ? new Date(q.to) : undefined);
      rows = tb.rows.map((r) => ({ account: `${r.code} ${r.name}`, debit: r.debit, credit: r.credit }));
    } else if (key === "profit-loss") {
      const from = q.from ? new Date(q.from) : new Date(new Date().getFullYear(), 0, 1);
      const to = q.to ? new Date(q.to) : new Date();
      const pl = await this.accounting.profitLoss(from, to);
      rows = pl.rows.map((r) => ({ account: `${r.code} ${r.name}`, debit: r.type === "EXPENSE" ? r.amount : 0, credit: r.type === "REVENUE" ? r.amount : 0 }));
    }
    const totals = { debit: 0, credit: 0, sale: 0, rooms: 0, pax: 0, count: 0 };
    for (const r of rows) {
      totals.debit += Number(r.debit || 0);
      totals.credit += Number(r.credit || 0);
      totals.sale += Number(r.sale || r.amount || 0);
      totals.rooms += Number(r.rooms || 0);
      totals.pax += Number(r.pax || 0);
      totals.count += Number(r.count || r.bookings || 1);
    }
    const start = (page - 1) * pageSize;
    return {
      key,
      total: rows.length,
      page,
      pageSize,
      totals,
      check: { ...totals, tbBalanced: Math.abs(totals.debit - totals.credit) < 0.009 },
      rows: rows.slice(start, start + pageSize),
    };
  }

  private async stayRows() {
    const segs = await this.prisma.hotelStaySegment.findMany({
      where: { booking: { cancelledAt: null } },
      include: {
        hotel: true,
        booking: { include: { customer: true } },
        rooms: { include: { pax: true } },
      },
    });
    if (segs.length) {
      return segs.map((s) => ({
        city: cityKey(s.hotel.city, s.hotel.name),
        hotel: s.hotel.name,
        hotelId: s.hotelId,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        nights: s.nights,
        rooms: s.rooms.length || 1,
        pax: s.rooms.reduce((n, r) => n + r.pax.length, 0),
        roomTypes: s.rooms.map((r) => r.roomTypeId || "Room"),
        sale: s.rooms.reduce((n, r) => n + Number(r.sellingPrice), 0),
        ref: s.booking.bookingNumber,
        customer: s.booking.customer?.fullName || "",
        customerId: s.booking.customerId,
        passengers: s.rooms.flatMap((r) => r.pax.map((p) => p.passengerId)).join(", "),
        status: s.status,
      }));
    }
    const books = await this.prisma.hotelBooking.findMany({
      where: { cancelledAt: null },
      include: { hotel: true, customer: true },
    });
    return books.map((b) => ({
      city: cityKey(b.hotel.city, b.hotel.name),
      hotel: b.hotel.name,
      hotelId: b.hotelId,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      rooms: b.rooms,
      pax: 0,
      roomTypes: [b.roomTypeId || "Room"],
      sale: Number(b.net || b.sellingPrice),
      ref: b.bookingNumber,
      customer: b.customer?.fullName || "",
      customerId: b.customerId,
      passengers: "",
      status: b.status,
    }));
  }

  private async ksa(key: string, q: Record<string, string>) {
    const rows: Record<string, unknown>[] = [];
    if (key === "ksa-arrival" || key === "ksa-departure") {
      const umrah = await this.prisma.umrahBooking.findMany({
        include: { customer: true, passengers: true },
      });
      umrah.forEach((u) => {
        const d = key === "ksa-arrival" ? u.departureDate : u.returnDate;
        if (!inRange(d, q.from, q.to)) return;
        if (q.customerId && u.customerId !== q.customerId) return;
        rows.push({
          date: d?.toISOString().slice(0, 10),
          reference: u.bookingNumber,
          customer: u.customer.fullName,
          pax: u.passengers.length,
          hotel: "",
          city: key === "ksa-arrival" ? "Arrival" : "Departure",
          module: "UMRAH",
        });
      });
    }
    const stays = await this.stayRows();
    stays.forEach((s) => {
      let d: Date | null = null;
      if (key === "ksa-arrival") d = s.checkIn;
      else if (key === "ksa-departure") d = s.checkOut;
      else if (key === "makkah-checkin" && s.city === "Makkah") d = s.checkIn;
      else if (key === "makkah-checkout" && s.city === "Makkah") d = s.checkOut;
      else if (key === "madinah-checkin" && s.city === "Madinah") d = s.checkIn;
      else if (key === "madinah-checkout" && s.city === "Madinah") d = s.checkOut;
      if (!d) return;
      if (!inRange(d, q.from, q.to)) return;
      if (q.hotel && q.hotel !== "all" && s.hotel !== q.hotel) return;
      rows.push({
        date: d.toISOString().slice(0, 10),
        reference: s.ref,
        customer: s.customer,
        pax: s.pax,
        hotel: s.hotel,
        city: s.city,
        rooms: s.rooms,
        module: "RESERVATION",
      });
    });
    return rows;
  }

  private async occupancySummary(city: string, q: Record<string, string>) {
    const map: Record<string, { hotel: string; city: string; bookings: number; rooms: number; pax: number; nights: number }> = {};
    (await this.stayRows()).forEach((s) => {
      if (s.city !== city) return;
      if (q.hotel && q.hotel !== "all" && s.hotel !== q.hotel) return;
      if (q.from && s.checkOut.toISOString().slice(0, 10) < q.from) return;
      if (q.to && s.checkIn.toISOString().slice(0, 10) > q.to) return;
      if (!map[s.hotel]) map[s.hotel] = { hotel: s.hotel, city, bookings: 0, rooms: 0, pax: 0, nights: 0 };
      map[s.hotel].bookings += 1;
      map[s.hotel].rooms += s.rooms;
      map[s.hotel].pax += s.pax;
      map[s.hotel].nights += s.nights * Math.max(s.rooms, 1);
    });
    return Object.values(map);
  }

  private async occupancyDetail(key: string, q: Record<string, string>) {
    const stays = (await this.stayRows()).filter((s) => {
      if (q.hotel && q.hotel !== "all" && s.hotel !== q.hotel) return false;
      if (q.from && s.checkOut.toISOString().slice(0, 10) < q.from) return false;
      if (q.to && s.checkIn.toISOString().slice(0, 10) > q.to) return false;
      return true;
    });
    if (key === "hotel-detail-2") {
      const by: Record<string, { date: string; hotel: string; rooms: number; pax: number }> = {};
      stays.forEach((s) => {
        const a = new Date(s.checkIn);
        const b = new Date(s.checkOut);
        for (let t = new Date(a); t < b; t = new Date(t.getTime() + 86400000)) {
          const d = t.toISOString().slice(0, 10);
          if (q.from && d < q.from) continue;
          if (q.to && d > q.to) continue;
          if (!by[d]) by[d] = { date: d, hotel: s.hotel, rooms: 0, pax: 0 };
          by[d].rooms += s.rooms;
          by[d].pax += s.pax;
        }
      });
      return Object.values(by);
    }
    if (key === "hotel-detail-3") {
      const by: Record<string, { hotel: string; room_type: string; rooms: number; pax: number; sale: number }> = {};
      stays.forEach((s) => {
        const type = s.roomTypes[0] || "Room";
        const k = s.hotel + type;
        if (!by[k]) by[k] = { hotel: s.hotel, room_type: type, rooms: 0, pax: 0, sale: 0 };
        by[k].rooms += s.rooms;
        by[k].pax += s.pax;
        by[k].sale += s.sale;
      });
      return Object.values(by);
    }
    return stays.map((s) => ({
      reference: s.ref,
      hotel: s.hotel,
      city: s.city,
      customer: s.customer,
      passengers: key === "hotel-full" ? s.passengers : undefined,
      check_in: s.checkIn.toISOString().slice(0, 10),
      check_out: s.checkOut.toISOString().slice(0, 10),
      rooms: s.rooms,
      pax: s.pax,
      nights: s.nights,
      status: s.status,
    }));
  }

  private async approvalBooking(q: Record<string, string>) {
    const map: Record<string, { module: string; status: string; count: number; sale: number }> = {};
    const bump = (module: string, status: string, sale: number) => {
      if (q.status && q.status !== "all" && status !== q.status) return;
      const k = module + status;
      if (!map[k]) map[k] = { module, status, count: 0, sale: 0 };
      map[k].count += 1;
      map[k].sale += sale;
    };
    const umrah = await this.prisma.umrahBooking.findMany();
    umrah.forEach((u) => bump("UMRAH", u.status, Number(u.net)));
    const hotels = await this.prisma.hotelBooking.findMany({ where: { cancelledAt: null } });
    hotels.forEach((h) => bump(h.kind === "STAR" ? "STAR" : "RESERVATION", h.status, Number(h.net)));
    const tickets = await this.prisma.ticketSale.findMany();
    tickets.forEach((t) => bump("TICKETS", t.status, Number(t.net)));
    return Object.values(map);
  }

  private async approvalPax(q: Record<string, string>) {
    const passengers = await this.prisma.umrahBookingPassenger.findMany({
      include: { booking: true, passenger: true },
    });
    const map: Record<string, { status: string; count: number }> = {};
    passengers.forEach((p) => {
      const st = p.booking.status;
      if (q.status && q.status !== "all" && st !== q.status) return;
      if (!map[st]) map[st] = { status: st, count: 0 };
      map[st].count += 1;
    });
    return Object.values(map);
  }

  private async dailySale(q: Record<string, string>) {
    const by: Record<string, { date: string; count: number; sale: number; cost: number; paid: number; profit: number }> = {};
    const add = (date: Date | null, sale: number, cost: number, paid: number) => {
      if (!date) return;
      if (!inRange(date, q.from, q.to)) return;
      const d = date.toISOString().slice(0, 10);
      if (!by[d]) by[d] = { date: d, count: 0, sale: 0, cost: 0, paid: 0, profit: 0 };
      by[d].count += 1;
      by[d].sale += sale;
      by[d].cost += cost;
      by[d].paid += paid;
      by[d].profit = by[d].sale - by[d].cost;
    };
    (await this.prisma.umrahBooking.findMany()).forEach((u) => add(u.departureDate || u.createdAt, Number(u.net), Number(u.cost), Number(u.paid)));
    (await this.prisma.ticketSale.findMany()).forEach((t) => add(t.createdAt, Number(t.net), Number(t.cost), Number(t.paidAmount || 0)));
    (await this.prisma.hotelBooking.findMany({ where: { cancelledAt: null } })).forEach((h) => add(h.checkIn, Number(h.net), Number(h.cost), Number(h.paid)));
    (await this.prisma.transportBooking.findMany()).forEach((t) => add(t.tripDate || t.createdAt, Number(t.net), Number(t.cost), Number(t.paid || 0)));
    (await this.prisma.starBooking.findMany()).forEach((s) => add(s.createdAt, Number(s.sellingPrice), Number(s.cost), Number(s.paid)));
    return Object.values(by).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async receivables() {
    const posted = await this.accounting.arAp("customer");
    if (posted.length) {
      const ids = posted.map((p) => p.partyId).filter((id) => id !== "unknown");
      const customers = await this.prisma.customer.findMany({ where: { id: { in: ids } } });
      const names = Object.fromEntries(customers.map((c) => [c.id, c.fullName]));
      return posted.map((p) => ({ party: names[p.partyId] || p.partyId, debit: p.balance, count: 1, clientId: p.partyId }));
    }
    const umrah = await this.prisma.umrahBooking.findMany({ include: { customer: true } });
    const hotels = await this.prisma.hotelBooking.findMany({ where: { cancelledAt: null }, include: { customer: true } });
    const tickets = await this.prisma.ticketSale.findMany({ include: { customer: true } });
    const map: Record<string, { party: string; debit: number; count: number; clientId: string }> = {};
    const bump = (id: string | null | undefined, name: string, due: number) => {
      if (due <= 0.009 || !id) return;
      if (!map[id]) map[id] = { party: name, debit: 0, count: 0, clientId: id };
      map[id].debit += due;
      map[id].count += 1;
    };
    umrah.forEach((u) => bump(u.customerId, u.customer.fullName, Number(u.balance)));
    hotels.forEach((h) => bump(h.customerId, h.customer?.fullName || "", Number(h.balance)));
    tickets.forEach((t) => bump(t.customerId, t.customer?.fullName || "", Number(t.net) - Number(t.paidAmount || 0)));
    return Object.values(map);
  }
}
