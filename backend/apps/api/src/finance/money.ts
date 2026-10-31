import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export type MoneyInput = string | number | Prisma.Decimal;

/** Database Decimal(18,2), without silently rounding excess scale or magnitude. */
export function money(input: unknown, positive = false): Prisma.Decimal {
  const text = input instanceof Prisma.Decimal ? input.toFixed() : String(input ?? "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new BadRequestException("Use an exact amount with at most two decimal places");
  const value = new Prisma.Decimal(text);
  if (typeof input === "number" && value.greaterThan("1000000000000")) throw new BadRequestException("Send large amounts as exact decimal strings");
  if (value.isNegative() || (positive && value.isZero()) || value.greaterThan("9999999999999999.99")) throw new BadRequestException("Amount is outside the permitted range");
  return value;
}

export function paymentMethod(input: unknown): "CASH" | "BANK" {
  if (input !== "CASH" && input !== "BANK") throw new BadRequestException("Choose CASH or BANK; other methods have no approved posting account");
  return input;
}
