import "server-only";

import { loginFailureMessage, loginSuccessMessage, loginUnavailableMessage, validateLogin } from "@/lib/login";
import { linkWebsiteCustomerToCrm } from "@/server/customer-auth/crm-link";
import { hashPassword, verifyPassword } from "@/server/customer-auth/password";
import { createSession } from "@/server/customer-auth/session";
import { CustomerDatabaseNotConfiguredError } from "@/server/customer-db/db";
import { findCustomerByEmail, type CustomerRecord } from "@/server/customer-db/repository";
import {
  CustomerWritesDisabledError,
  customerWritesEnabled,
} from "@/server/customer-auth/write-access";

export type LoginResponse =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

let timingHash: Promise<string> | null = null;

type LoginDependencies = {
  findCustomerByEmail: typeof findCustomerByEmail;
  verifyPassword: typeof verifyPassword;
  createSession: typeof createSession;
  linkWebsiteCustomerToCrm: typeof linkWebsiteCustomerToCrm;
};

const defaultDependencies: LoginDependencies = {
  findCustomerByEmail,
  verifyPassword,
  createSession,
  linkWebsiteCustomerToCrm,
};

function passwordTimingHash() {
  timingHash ??= hashPassword("timing-only-placeholder");
  return timingHash;
}

export async function loginCustomer(
  body: unknown,
  dependencies: LoginDependencies = defaultDependencies,
): Promise<{ status: number; body: LoginResponse }> {
  if (!customerWritesEnabled()) {
    return { status: 503, body: { ok: false, error: loginUnavailableMessage } };
  }

  const parsed = validateLogin(body);
  if (!parsed.ok) return { status: 400, body: parsed };

  if (Buffer.byteLength(parsed.data.password) > 72) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Check the sign-in fields.",
        fields: { password: "Use a shorter password." },
      },
    };
  }

  try {
    const customer: CustomerRecord | null = await dependencies.findCustomerByEmail(parsed.data.email);
    const passwordHash = customer ? customer.passwordHash : await passwordTimingHash();
    const passwordMatches = await dependencies.verifyPassword(parsed.data.password, passwordHash);
    if (!customer || !passwordMatches) {
      return { status: 401, body: { ok: false, error: loginFailureMessage } };
    }
    await dependencies.createSession(customer.id);
    if (!customer.crmCustomerId) {
      await dependencies.linkWebsiteCustomerToCrm({
        websiteCustomerId: customer.id,
        email: customer.email,
        displayName: customer.displayName,
      });
    }
  } catch (error) {
    if (error instanceof CustomerWritesDisabledError) {
      return { status: 503, body: { ok: false, error: loginUnavailableMessage } };
    }
    if (error instanceof CustomerDatabaseNotConfiguredError) {
      return { status: 503, body: { ok: false, error: loginUnavailableMessage } };
    }
    return { status: 500, body: { ok: false, error: loginUnavailableMessage } };
  }

  return { status: 200, body: { ok: true, message: loginSuccessMessage } };
}
