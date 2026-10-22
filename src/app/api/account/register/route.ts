import { accountResponse } from "@/server/customer-auth/http";
import { registerCustomer } from "@/server/customer-auth/register";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the registration as JSON." }, 400);
  }

  const result = await runCustomerAuth("register", body, () => registerCustomer(body));
  const response = accountResponse(result.body, result.status);
  if (result.status === 429) response.headers.set("Retry-After", "900");
  return response;
}
import { runCustomerAuth } from "@/server/customer-auth/rate-limit";
