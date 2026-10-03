/** Allowlisted booking fields for /my-bookings display (matches BFF DTO). */

export const ACCOUNT_BOOKING_STATUSES = [
  "Upcoming",
  "Completed",
  "Cancelled",
] as const;

export type AccountBookingStatus = (typeof ACCOUNT_BOOKING_STATUSES)[number];

export type AccountBooking = {
  reference: string;
  service: string;
  destination: string;
  travelDate: string;
  status: AccountBookingStatus;
  createdAt: string;
  updatedAt: string;
};

function asNonEmptyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isStatus(value: string): value is AccountBookingStatus {
  return (ACCOUNT_BOOKING_STATUSES as readonly string[]).includes(value);
}

/** Project one BFF booking row for display. Extra CRM/financial fields are dropped. */
export function parseAccountBooking(row: unknown): AccountBooking | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  const reference = asNonEmptyString(record.reference);
  const service = asNonEmptyString(record.service);
  const destination = asNonEmptyString(record.destination);
  const travelDate = asNonEmptyString(record.travelDate);
  const status = asNonEmptyString(record.status);
  const createdAt = asNonEmptyString(record.createdAt);
  const updatedAt = asNonEmptyString(record.updatedAt);
  if (!reference || !service || !destination || !travelDate || !createdAt || !updatedAt) return null;
  if (!isStatus(status)) return null;
  return { reference, service, destination, travelDate, status, createdAt, updatedAt };
}

export type AccountBookingsParseResult =
  | { ok: true; bookings: AccountBooking[] }
  | { ok: false; kind: "unauthorized" | "unavailable" | "invalid" };

/** Parse GET /api/account/bookings JSON. Never reads identity selectors from the payload. */
export function parseAccountBookingsResponse(
  status: number,
  body: unknown,
): AccountBookingsParseResult {
  if (status === 401) return { ok: false, kind: "unauthorized" };
  if (status === 503) return { ok: false, kind: "unavailable" };
  if (status !== 200) return { ok: false, kind: "unavailable" };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, kind: "invalid" };
  }
  const record = body as { ok?: unknown; bookings?: unknown };
  if (record.ok !== true || !Array.isArray(record.bookings)) {
    return { ok: false, kind: "invalid" };
  }
  const bookings = record.bookings
    .map((row) => parseAccountBooking(row))
    .filter((row): row is AccountBooking => row != null);
  return { ok: true, bookings };
}
