/** Approved customer-booking DTO fields only (CRM Step 64 / website Step 66). */

export const CUSTOMER_BOOKING_SERVICES = [
  "Flight",
  "Hotel",
  "Umrah",
  "Visa",
  "Transport",
] as const;

export const CUSTOMER_BOOKING_STATUSES = [
  "Upcoming",
  "Completed",
  "Cancelled",
] as const;

export type CustomerBookingService = (typeof CUSTOMER_BOOKING_SERVICES)[number];
export type CustomerBookingStatus = (typeof CUSTOMER_BOOKING_STATUSES)[number];

export type CustomerBookingDto = {
  reference: string;
  service: CustomerBookingService;
  destination: string;
  travelDate: string;
  status: CustomerBookingStatus;
  createdAt: string;
  updatedAt: string;
};

function isService(value: string): value is CustomerBookingService {
  return (CUSTOMER_BOOKING_SERVICES as readonly string[]).includes(value);
}

function isStatus(value: string): value is CustomerBookingStatus {
  return (CUSTOMER_BOOKING_STATUSES as readonly string[]).includes(value);
}

function asNonEmptyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/** Project one CRM booking row into the allowlisted website DTO, or null if unsafe/incomplete. */
export function sanitizeCustomerBooking(row: unknown): CustomerBookingDto | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const reference = asNonEmptyString(record.reference);
  const service = asNonEmptyString(record.service);
  const destination = asNonEmptyString(record.destination);
  const travelDate = asNonEmptyString(record.travelDate);
  const status = asNonEmptyString(record.status);
  const createdAt = asNonEmptyString(record.createdAt);
  const updatedAt = asNonEmptyString(record.updatedAt);

  if (!reference || !destination || !travelDate || !createdAt || !updatedAt) return null;
  if (!isService(service) || !isStatus(status)) return null;

  return {
    reference,
    service,
    destination,
    travelDate,
    status,
    createdAt,
    updatedAt,
  };
}

/** Sanitize a CRM `{ bookings: unknown }` payload. Returns null if the envelope is invalid. */
export function sanitizeCustomerBookingsResponse(body: unknown): CustomerBookingDto[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const bookings = (body as { bookings?: unknown }).bookings;
  if (!Array.isArray(bookings)) return null;
  const rows = bookings.map((row) => sanitizeCustomerBooking(row));
  if (rows.some(row => row === null)) return null;
  return rows as CustomerBookingDto[];
}
