import { logoutSuccessMessage, logoutUnavailableMessage } from "@/lib/login";
import { accountResponse } from "@/server/customer-auth/http";
import { destroySession } from "@/server/customer-auth/session";
import { customerWritesEnabled } from "@/server/customer-auth/write-access";

export async function POST() {
  if (!customerWritesEnabled()) {
    return accountResponse({ ok: false, error: logoutUnavailableMessage }, 503);
  }

  try {
    await destroySession();
  } catch {
    return accountResponse({ ok: false, error: logoutUnavailableMessage }, 500);
  }

  return accountResponse({ ok: true, message: logoutSuccessMessage });
}
