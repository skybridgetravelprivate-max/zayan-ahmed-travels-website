import { accountResponse } from "@/server/customer-auth/http";
import { getCurrentCustomer } from "@/server/customer-auth/session";
import { resolveAccountBookings } from "@/server/customer-bookings/resolve";

/**
 * GET /api/account/bookings
 * Session identity only — browser query/headers cannot select another customer.
 */
export async function GET() {
  const customer = await getCurrentCustomer();
  const resolved = await resolveAccountBookings(customer);
  return accountResponse(resolved.body, resolved.status);
}
