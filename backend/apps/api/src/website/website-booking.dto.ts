/** Website My Bookings DTO (matches zayan-website customer-bookings/dto.ts allowlist). */

export const WEBSITE_BOOKING_SERVICES = ["Flight", "Hotel", "Umrah", "Visa", "Transport"] as const;
export type WebsiteBookingService = (typeof WEBSITE_BOOKING_SERVICES)[number];

export const WEBSITE_BOOKING_STATUSES = ["Upcoming", "Completed", "Cancelled"] as const;
export type WebsiteBookingStatus = (typeof WEBSITE_BOOKING_STATUSES)[number];

export type WebsiteCustomerBookingDto = {
  reference: string;
  service: WebsiteBookingService;
  destination: string;
  travelDate: string;
  status: WebsiteBookingStatus;
  createdAt: string;
  updatedAt: string;
};

export function isoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString();
}

export function travelDateFrom(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function mapWebsiteStatus(raw: string, cancelled: boolean): WebsiteBookingStatus | null {
  if (cancelled) return "Cancelled";
  const upper = raw.toUpperCase();
  if (upper.includes("CANCEL")) return "Cancelled";
  if (upper === "COMPLETED" || upper === "APPROVED" || upper === "ISSUED") return "Completed";
  return "Upcoming";
}

export function isWebsiteBookingRow(row: WebsiteCustomerBookingDto): boolean {
  return (
    Boolean(row.reference && row.destination && row.travelDate && row.createdAt && row.updatedAt) &&
    (WEBSITE_BOOKING_SERVICES as readonly string[]).includes(row.service) &&
    (WEBSITE_BOOKING_STATUSES as readonly string[]).includes(row.status)
  );
}
