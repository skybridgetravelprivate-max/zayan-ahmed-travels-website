import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string) {
  if (!plain || String(plain).length < 10) {
    throw new Error("Password must be at least 10 characters");
  }
  return bcrypt.hash(plain, ROUNDS);
}
