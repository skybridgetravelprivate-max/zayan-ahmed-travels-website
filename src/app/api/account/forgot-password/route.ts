import { accountResponse } from "@/server/customer-auth/http";
import { runCustomerAuth } from "@/server/customer-auth/rate-limit";
import { requestCustomerPasswordRecovery } from "@/server/customer-auth/recovery";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return accountResponse({ ok: false, error: "Send the recovery request as JSON." }, 400);
  }

  const result = await runCustomerAuth(
    "forgot-password",
    body,
    () => requestCustomerPasswordRecovery(body),
  );
  const response = accountResponse(result.body, result.status);
  if (result.status === 429) response.headers.set("Retry-After", "900");
  return response;
}
