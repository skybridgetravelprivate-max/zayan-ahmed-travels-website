import { accountResponse } from "@/server/customer-auth/http";
import { registerCustomer } from "@/server/customer-auth/register";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the registration as JSON." }, 400);
  }

  const result = await registerCustomer(body);
  return accountResponse(result.body, result.status);
}
