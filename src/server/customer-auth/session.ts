import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { CustomerRecordError, type CustomerRecord, type SessionRecord } from "@/server/customer-db/repository";
import * as customerRepository from "@/server/customer-db/repository";

/** Customer session cookie. This is not the CRM access_token cookie. */
export const customerSessionCookie = "customer_session";

const sessionSeconds = 60 * 60 * 24 * 7;

export type CurrentCustomer = {
  id: string;
  email: string;
  displayName: string;
  crmCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

type SessionResolutionRepository = {
  findSessionByTokenHash: (tokenHash: string) => Promise<SessionRecord | null>;
  findCustomerById: (id: string) => Promise<CustomerRecord | null>;
  revokeSessionByTokenHash: (tokenHash: string) => Promise<void>;
};

const sessionResolutionRepository: SessionResolutionRepository = {
  findSessionByTokenHash: customerRepository.findSessionByTokenHash,
  findCustomerById: customerRepository.findCustomerById,
  revokeSessionByTokenHash: customerRepository.revokeSessionByTokenHash,
};

export async function resolveCustomerSession(
  tokenHash: string,
  nowIso = new Date().toISOString(),
  repository: SessionResolutionRepository = sessionResolutionRepository,
): Promise<CurrentCustomer | null> {
  const session = await repository.findSessionByTokenHash(tokenHash);
  if (!session || session.revokedAt || session.expiresAt <= nowIso) return null;

  const customer = await repository.findCustomerById(session.customerId);
  if (!customer) {
    await repository.revokeSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    id: customer.id,
    email: customer.email,
    displayName: customer.displayName,
    crmCustomerId: customer.crmCustomerId,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

type SessionRevocationRepository = {
  revokeSessionByTokenHash: (tokenHash: string) => Promise<void>;
};

export async function revokeCustomerSession(
  tokenHash: string | null,
  repository: SessionRevocationRepository = customerRepository,
): Promise<void> {
  if (tokenHash) await repository.revokeSessionByTokenHash(tokenHash);
}

type LogoutRepository = SessionRevocationRepository & {
  deleteExpiredSessions: (nowIso: string) => Promise<void>;
};

export async function logoutCustomer(
  tokenHash: string | null,
  clearCookie: () => Promise<void>,
  repository: LogoutRepository = customerRepository,
): Promise<void> {
  try {
    await revokeCustomerSession(tokenHash, repository);
    await repository.deleteExpiredSessions(new Date().toISOString());
  } finally {
    await clearCookie();
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function currentTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(customerSessionCookie)?.value ?? "";
  if (!token) return null;
  return hashSessionToken(token);
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(customerSessionCookie, "", sessionCookieOptions(0));
}

async function removeExpiredSessions() {
  await customerRepository.deleteExpiredSessions(new Date().toISOString());
}

/** Creates a new customer session and sets the session cookie. */
export async function createSession(customerId: string) {
  await removeExpiredSessions();
  const previousHash = await currentTokenHash();
  if (previousHash) await customerRepository.revokeSessionByTokenHash(previousHash);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
    try {
      await customerRepository.insertSession({ customerId, tokenHash, expiresAt });
    } catch (error) {
      if (error instanceof CustomerRecordError && error.code === "session-token-taken") continue;
      throw error;
    }
    const cookieStore = await cookies();
    cookieStore.set(customerSessionCookie, token, sessionCookieOptions(sessionSeconds));
    return;
  }

  throw new CustomerRecordError("A session could not be created.", "session-token-taken");
}

/** Returns the signed-in customer, without the password hash. */
export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  await connection();
  const tokenHash = await currentTokenHash();
  if (!tokenHash) return null;
  return resolveCustomerSession(tokenHash);
}

/** Deletes the current customer session and clears its cookie. */
export async function destroySession() {
  await logoutCustomer(await currentTokenHash(), clearSessionCookie);
}
