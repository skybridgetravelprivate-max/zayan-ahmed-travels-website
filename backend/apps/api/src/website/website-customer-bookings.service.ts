import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import {
  isoDate,
  mapWebsiteStatus,
  travelDateFrom,
  type WebsiteCustomerBookingDto,
} from "./website-booking.dto";

@Injectable()
export class WebsiteCustomerBookingsService {
  constructor(private prisma: PrismaService) {}

  async listForWebsiteCustomer(websiteCustomerId: string): Promise<{ bookings: WebsiteCustomerBookingDto[] }> {
    const id = websiteCustomerId.trim();
    if (!id || id.length > 64) {
      throw new BadRequestException();
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) {
      return { bookings: [] };
    }

    const [umrah, hotels, tickets, transports, visas] = await Promise.all([
      this.prisma.umrahBooking.findMany({
        where: { customerId: id },
        select: {
          bookingNumber: true,
          groupName: true,
          departureDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.hotelBooking.findMany({
        where: { customerId: id },
        select: {
          bookingNumber: true,
          checkIn: true,
          cancelledAt: true,
          status: true,
          hotel: { select: { name: true, city: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ticketSale.findMany({
        where: { customerId: id },
        select: {
          ticketNumber: true,
          id: true,
          sector: true,
          departureAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.transportBooking.findMany({
        where: { customerId: id },
        select: {
          bookingNumber: true,
          pickup: true,
          dropoff: true,
          route: true,
          tripDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.visaApplication.findMany({
        where: { customerId: id },
        select: {
          applicationNo: true,
          country: true,
          submittedAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const rows: WebsiteCustomerBookingDto[] = [];

    for (const row of umrah) {
      const status = mapWebsiteStatus(String(row.status), row.status === "CANCELLED");
      if (!status) continue;
      const destination = (row.groupName?.trim() || "Umrah").slice(0, 200);
      const travelDate = travelDateFrom(row.departureDate);
      rows.push({
        reference: row.bookingNumber,
        service: "Umrah",
        destination,
        travelDate,
        status,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt),
      });
    }

    for (const row of hotels) {
      const cancelled = Boolean(row.cancelledAt) || String(row.status).toUpperCase().includes("CANCEL");
      const status = mapWebsiteStatus(String(row.status), cancelled);
      if (!status) continue;
      const destination = [row.hotel?.name, row.hotel?.city].filter(Boolean).join(", ") || "Hotel";
      const travelDate = travelDateFrom(row.checkIn);
      rows.push({
        reference: row.bookingNumber,
        service: "Hotel",
        destination: destination.slice(0, 200),
        travelDate,
        status,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt),
      });
    }

    for (const row of tickets) {
      const status = mapWebsiteStatus(String(row.status), row.status === "CANCELLED" || row.status === "REFUNDED");
      if (!status) continue;
      const reference = (row.ticketNumber?.trim() || row.id).slice(0, 80);
      const destination = (row.sector?.trim() || "Flight").slice(0, 200);
      const travelDate = travelDateFrom(row.departureAt);
      rows.push({
        reference,
        service: "Flight",
        destination,
        travelDate,
        status,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt),
      });
    }

    for (const row of transports) {
      const status = mapWebsiteStatus(String(row.status), String(row.status).toUpperCase().includes("CANCEL"));
      if (!status) continue;
      const destination =
        [row.route, row.pickup && row.dropoff ? `${row.pickup} – ${row.dropoff}` : row.pickup || row.dropoff]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 200) || "Transport";
      const travelDate = travelDateFrom(row.tripDate);
      rows.push({
        reference: row.bookingNumber,
        service: "Transport",
        destination,
        travelDate,
        status,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt),
      });
    }

    for (const row of visas) {
      const status = mapWebsiteStatus(
        String(row.status),
        row.status === "CANCELLED" || row.status === "REJECTED",
      );
      if (!status) continue;
      const travelDate = travelDateFrom(row.submittedAt ?? row.createdAt);
      rows.push({
        reference: row.applicationNo,
        service: "Visa",
        destination: row.country.slice(0, 200),
        travelDate,
        status,
        createdAt: isoDate(row.createdAt),
        updatedAt: isoDate(row.updatedAt),
      });
    }

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { bookings: rows };
  }
}
