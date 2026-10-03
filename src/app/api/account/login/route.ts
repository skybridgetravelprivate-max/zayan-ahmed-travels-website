import { accountResponse } from "@/server/customer-auth/http";
import { loginCustomer } from "@/server/customer-auth/login";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the sign-in as JSON." }, 400);
  }

  const result = await loginCustomer(body);
  return accountResponse(result.body, result.status);
}
