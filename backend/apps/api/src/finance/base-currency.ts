import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/** Until FX posting is approved, all ledger writes must use the company basis. */
export async function assertBaseCurrency(
  db: Pick<Prisma.TransactionClient, "companySettings">,
  input: { currency?: unknown; exchangeRate?: unknown },
) {
  const settings = await db.companySettings?.findFirst({ select: { currencyCode: true } });
  // Matches CompanySettings.currencyCode's schema default for an unconfigured company.
  const base = settings?.currencyCode ?? "PKR";
  const currency = input.currency ?? base;
  const rate = String(input.exchangeRate ?? "1");
  if (currency !== base || !/^\d+(?:\.\d{1,6})?$/.test(rate) || !new Prisma.Decimal(rate).equals(1)) {
    throw new BadRequestException("Foreign-currency posting requires an approved accounting workflow");
  }
  return { currency: base, exchangeRate: new Prisma.Decimal(1) };
}
