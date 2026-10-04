import "server-only";
import { crmPublicOrigin } from "@/server/crm-public";
import {
  sanitizeCustomerBookingsResponse,
  type CustomerBookingDto,
} from "@/server/customer-bookings/dto";

const crmTimeoutMs = 10_000;

export type CustomerBookingsResult =
  | { ok: true; bookings: CustomerBookingDto[] }
  | { ok: false; status: 503; error: string };

function readInternalToken() {
  const token = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN?.trim() ?? "";
  if (token.length < 32) return "";
  return token;
}

/**
 * Fetches the signed-in website customer's bookings from the CRM S2S endpoint.
 * Identity must already be resolved from customer_session — never from request input.
 */
export async function fetchCustomerBookingsForWebsiteCustomer(
  websiteCustomerId: string,
): Promise<CustomerBookingsResult> {
  const id = websiteCustomerId.trim();
  if (!id || id.length > 64) {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  const origin = crmPublicOrigin();
  const token = readInternalToken();
  if (!origin || !token) {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  const url = new URL("/v1/customer/bookings", origin);
  url.searchParams.set("website_customer_id", id);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Zat-Internal-Token": token,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(crmTimeoutMs),
    });
  } catch {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  if (response.status === 401 || response.status === 403 || response.status === 503) {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }
  if (!response.ok) {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  const bookings = sanitizeCustomerBookingsResponse(body);
  if (!bookings) {
    return { ok: false, status: 503, error: "Bookings are temporarily unavailable." };
  }

  return { ok: true, bookings };
}
