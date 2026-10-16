import { linkWebsiteCustomerToCrm } from "@/server/customer-auth/crm-link";
import { CustomerWritesDisabledError } from "@/server/customer-auth/write-access";
import type { CurrentCustomer } from "@/server/customer-auth/session";
import {
  fetchCustomerBookingsForWebsiteCustomer,
  type CustomerBookingsResult,
} from "@/server/customer-bookings/fetch";
import type { CustomerBookingDto } from "@/server/customer-bookings/dto";

export type AccountBookingsBody =
  | { ok: true; bookings: CustomerBookingDto[] }
  | { ok: false; error: string };

type FetchBookings = (
  crmCustomerId: string,
) => Promise<CustomerBookingsResult>;

/**
 * Session identity only. Query/header customer selectors are intentionally ignored —
 * callers must pass the customer resolved from customer_session.
 * Bookings are fetched with Nest customer.id (crmCustomerId), not the website UUID.
 */
export async function resolveAccountBookings(
  customer: CurrentCustomer | null,
  fetchBookings: FetchBookings = fetchCustomerBookingsForWebsiteCustomer,
): Promise<{ status: number; body: AccountBookingsBody }> {
  if (!customer) {
    return { status: 401, body: { ok: false, error: "Sign in to view your bookings." } };
  }

  let crmId = customer.crmCustomerId?.trim() || "";
  if (!crmId) {
    try {
      crmId =
        (await linkWebsiteCustomerToCrm({
          websiteCustomerId: customer.id,
          email: customer.email,
          displayName: customer.displayName,
        })) ?? "";
    } catch (error) {
      if (error instanceof CustomerWritesDisabledError) {
        return { status: 503, body: { ok: false, error: "Bookings are temporarily unavailable." } };
      }
      throw error;
    }
  }

  if (!crmId) {
    return { status: 503, body: { ok: false, error: "Bookings are temporarily unavailable." } };
  }

  const result = await fetchBookings(crmId);
  if (!result.ok) {
    return { status: result.status, body: { ok: false, error: result.error } };
  }

  return { status: 200, body: { ok: true, bookings: result.bookings } };
}
