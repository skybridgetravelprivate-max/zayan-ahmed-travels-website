import {
  fetchCustomerBookingsForWebsiteCustomer,
  type CustomerBookingsResult,
} from "@/server/customer-bookings/fetch";
import type { CustomerBookingDto } from "@/server/customer-bookings/dto";

export type AccountBookingsBody =
  | { ok: true; bookings: CustomerBookingDto[] }
  | { ok: false; error: string };

type FetchBookings = (
  websiteCustomerId: string,
) => Promise<CustomerBookingsResult>;

/**
 * Session identity only. Query/header customer selectors are intentionally ignored —
 * callers must pass the customer resolved from customer_session.
 */
export async function resolveAccountBookings(
  customer: { id: string } | null,
  fetchBookings: FetchBookings = fetchCustomerBookingsForWebsiteCustomer,
): Promise<{ status: number; body: AccountBookingsBody }> {
  if (!customer) {
    return { status: 401, body: { ok: false, error: "Sign in to view your bookings." } };
  }

  const result = await fetchBookings(customer.id);
  if (!result.ok) {
    return { status: result.status, body: { ok: false, error: result.error } };
  }

  return { status: 200, body: { ok: true, bookings: result.bookings } };
}
