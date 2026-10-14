import { accountResponse } from "@/server/customer-auth/http";
import { registerCustomer } from "@/server/customer-auth/register";
import { publicRateLimitResponse } from "@/server/public-rate-limit";

export async function POST(request: Request) {
  const rateLimited = publicRateLimitResponse(request, "customer-auth");
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the registration as JSON." }, 400);
  }

  const result = await registerCustomer(body);
  return accountResponse(result.body, result.status);
}
