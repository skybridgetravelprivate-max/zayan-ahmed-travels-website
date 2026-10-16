import "server-only";

import { validateRegistration, registrationSuccessMessage, registrationUnavailableMessage } from "@/lib/registration";
import { linkWebsiteCustomerToCrm } from "@/server/customer-auth/crm-link";
import { hashPassword } from "@/server/customer-auth/password";
import { CustomerDatabaseNotConfiguredError } from "@/server/customer-db/db";
import {
  CustomerRecordError,
  insertCustomer,
  type CustomerRecord,
} from "@/server/customer-db/repository";

export type RegistrationResponse =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

const bcryptByteLimit = 72;

type RegisterDependencies = {
  hashPassword: typeof hashPassword;
  insertCustomer: typeof insertCustomer;
  linkWebsiteCustomerToCrm: typeof linkWebsiteCustomerToCrm;
};

const defaultDependencies: RegisterDependencies = {
  hashPassword,
  insertCustomer,
  linkWebsiteCustomerToCrm,
};

export async function registerCustomer(
  body: unknown,
  dependencies: RegisterDependencies = defaultDependencies,
): Promise<{ status: number; body: RegistrationResponse }> {
  const parsed = validateRegistration(body);
  if (!parsed.ok) return { status: 400, body: parsed };

  if (Buffer.byteLength(parsed.data.password) > bcryptByteLimit) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "Check the registration fields.",
        fields: { password: "Use a shorter password." },
      },
    };
  }

  let passwordHash: string;
  try {
    passwordHash = await dependencies.hashPassword(parsed.data.password);
  } catch {
    return { status: 500, body: { ok: false, error: registrationUnavailableMessage } };
  }

  try {
    const customer: CustomerRecord = await dependencies.insertCustomer({
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash,
    });
    // Soft link — registration succeeds even if Nest is unavailable.
    await dependencies.linkWebsiteCustomerToCrm({
      websiteCustomerId: customer.id,
      email: customer.email,
      displayName: customer.displayName,
    });
  } catch (error) {
    if (error instanceof CustomerRecordError && error.code === "email-taken") {
      return { status: 400, body: { ok: false, error: registrationUnavailableMessage } };
    }
    if (error instanceof CustomerDatabaseNotConfiguredError || error instanceof CustomerRecordError) {
      return { status: 503, body: { ok: false, error: registrationUnavailableMessage } };
    }
    return { status: 500, body: { ok: false, error: registrationUnavailableMessage } };
  }

  return { status: 201, body: { ok: true, message: registrationSuccessMessage } };
}
