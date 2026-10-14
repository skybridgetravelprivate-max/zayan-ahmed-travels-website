import { accountResponse } from "@/server/customer-auth/http";
import { loginCustomer } from "@/server/customer-auth/login";
import { publicRateLimitResponse } from "@/server/public-rate-limit";

export async function POST(request: Request) {
  const rateLimited = publicRateLimitResponse(request, "customer-auth");
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the sign-in as JSON." }, 400);
  }

  const result = await loginCustomer(body);
  return accountResponse(result.body, result.status);
}
