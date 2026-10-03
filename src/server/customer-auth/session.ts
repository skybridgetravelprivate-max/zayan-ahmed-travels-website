import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { CustomerDatabaseNotConfiguredError } from "@/server/customer-db/db";
import {
  CustomerRecordError,
  deleteExpiredSessions,
  deleteSessionByTokenHash,
  findCustomerById,
  findSessionByTokenHash,
  insertSession,
} from "@/server/customer-db/repository";

/** Customer session cookie. This is not the CRM access_token cookie. */
export const customerSessionCookie = "customer_session";

const sessionSeconds = 60 * 60 * 24 * 7;

export type CurrentCustomer = {
  id: string;
  email: string;
  displayName: string;
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

function removeExpiredSessions() {
  deleteExpiredSessions(new Date().toISOString());
}

/** Creates a new customer session and sets the session cookie. */
export async function createSession(customerId: string) {
  removeExpiredSessions();
  const previousHash = await currentTokenHash();
  if (previousHash) deleteSessionByTokenHash(previousHash);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + sessionSeconds * 1000).toISOString();
    try {
      insertSession({ customerId, tokenHash, expiresAt });
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
  try {
    const tokenHash = await currentTokenHash();
    removeExpiredSessions();
    if (!tokenHash) return null;

    const session = findSessionByTokenHash(tokenHash);
    if (!session || session.expiresAt <= new Date().toISOString()) {
      if (session) deleteSessionByTokenHash(tokenHash);
      return null;
    }

    const customer = findCustomerById(session.customerId);
    if (!customer) {
      deleteSessionByTokenHash(tokenHash);
      return null;
    }

    return {
      id: customer.id,
      email: customer.email,
      displayName: customer.displayName,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  } catch (error) {
    if (error instanceof CustomerDatabaseNotConfiguredError) return null;
    return null;
  }
}

/** Deletes the current customer session and clears its cookie. */
export async function destroySession() {
  try {
    removeExpiredSessions();
    const tokenHash = await currentTokenHash();
    if (tokenHash) deleteSessionByTokenHash(tokenHash);
  } finally {
    await clearSessionCookie();
  }
}
