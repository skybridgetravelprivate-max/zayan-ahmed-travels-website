import { logoutSuccessMessage, logoutUnavailableMessage } from "@/lib/login";
import { accountResponse } from "@/server/customer-auth/http";
import { destroySession } from "@/server/customer-auth/session";

export async function POST() {
  try {
    await destroySession();
  } catch {
    return accountResponse({ ok: false, error: logoutUnavailableMessage }, 500);
  }

  return accountResponse({ ok: true, message: logoutSuccessMessage });
}
