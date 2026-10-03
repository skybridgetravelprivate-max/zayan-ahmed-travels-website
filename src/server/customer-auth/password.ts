import "server-only";

import bcrypt from "bcryptjs";

const passwordCost = 12;

/** Hashes a password with bcrypt. The plaintext is not stored or logged. */
export function hashPassword(password: string) {
  return bcrypt.hash(password, passwordCost);
}

/** Checks a password against a stored bcrypt hash. */
export async function verifyPassword(password: string, passwordHash: string) {
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}
