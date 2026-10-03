import "server-only";

import { validateRegistration, registrationSuccessMessage, registrationUnavailableMessage } from "@/lib/registration";
import { CustomerDatabaseNotConfiguredError } from "@/server/customer-db/db";
import { CustomerRecordError, insertCustomer } from "@/server/customer-db/repository";
import { hashPassword } from "@/server/customer-auth/password";

export type RegistrationResponse =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> };

const bcryptByteLimit = 72;

export async function registerCustomer(body: unknown): Promise<{ status: number; body: RegistrationResponse }> {
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
    passwordHash = await hashPassword(parsed.data.password);
  } catch {
    return { status: 500, body: { ok: false, error: registrationUnavailableMessage } };
  }

  try {
    insertCustomer({
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      passwordHash,
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
