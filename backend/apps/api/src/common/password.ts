import { BadRequestException } from "@nestjs/common";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string) {
  assertPasswordPolicy(plain);
  return bcrypt.hash(plain, ROUNDS);
}

export function assertPasswordPolicy(plain: string) {
  const p = String(plain || "");
  if (p.length < 10) {
    throw new BadRequestException("Password must be at least 10 characters");
  }
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
