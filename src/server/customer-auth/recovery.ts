import "server-only";

import {
  customerRecoveryInvalidMessage,
  customerRecoveryRequestMessage,
  customerRecoveryResetMessage,
  customerRecoveryUnavailableMessage,
} from "@/lib/customer-recovery";
import { crmPublicOrigin } from "@/server/crm-public";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const internalTokenHeader = "X-Zat-Internal-Token";
const recoveryTimeoutMs = 10_000;

export type CustomerRecoveryResult = {
  status: number;
  body: { ok: boolean; message?: string; error?: string };
};

type RecoveryAction = "forgot-password" | "reset-password";
type Fetcher = typeof fetch;

function readInternalToken() {
  const token = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN?.trim() ?? "";
  return token.length >= 32 ? token : "";
}

async function sendRecoveryRequest(
  action: RecoveryAction,
  body: Record<string, string>,
  fetcher: Fetcher,
): Promise<CustomerRecoveryResult> {
  const origin = crmPublicOrigin();
  const token = readInternalToken();
  if (!origin || !token) {
    return { status: 503, body: { ok: false, error: customerRecoveryUnavailableMessage } };
  }

  let response: Response;
  try {
    response = await fetcher(new URL(`/v1/customer/${action}`, origin), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [internalTokenHeader]: token,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(recoveryTimeoutMs),
    });
  } catch {
    return { status: 503, body: { ok: false, error: customerRecoveryUnavailableMessage } };
  }

  if (response.ok) {
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (result && typeof result === "object" && !Array.isArray(result) && "ok" in result && result.ok === true) {
      return {
        status: 200,
        body: {
          ok: true,
          message: action === "forgot-password" ? customerRecoveryRequestMessage : customerRecoveryResetMessage,
        },
      };
    }
  }

  if (action === "reset-password" && response.status === 400) {
    return { status: 400, body: { ok: false, error: customerRecoveryInvalidMessage } };
  }
  return { status: 503, body: { ok: false, error: customerRecoveryUnavailableMessage } };
}

export function requestCustomerPasswordRecovery(
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<CustomerRecoveryResult> {
  const email = body && typeof body === "object" && !Array.isArray(body) && "email" in body && typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  if (!email || email.length > 254 || !emailPattern.test(email)) {
    return Promise.resolve({ status: 400, body: { ok: false, error: "Enter a valid email address." } });
  }
  return sendRecoveryRequest("forgot-password", { email }, fetcher);
}

export function resetCustomerPassword(
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<CustomerRecoveryResult> {
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const token = typeof record.token === "string" ? record.token : "";
  const password = typeof record.password === "string" ? record.password : "";
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    return Promise.resolve({ status: 400, body: { ok: false, error: customerRecoveryInvalidMessage } });
  }
  return sendRecoveryRequest("reset-password", { token, password }, fetcher);
}
