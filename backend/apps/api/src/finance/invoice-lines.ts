import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { money, type MoneyInput } from "./money";

export function invoiceLines(input: { serviceId?: string; description: string; qty?: number; unitPrice: MoneyInput; cost?: MoneyInput }[]) {
  if (!Array.isArray(input) || !input.length || input.length > 500) throw new BadRequestException("Add between 1 and 500 service lines");
  return input.map(line => {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw new BadRequestException("Each service line must be an object");
    if (line.serviceId !== undefined && (typeof line.serviceId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(line.serviceId))) throw new BadRequestException("Invalid service reference");
    const qty = line.qty ?? 1;
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 2147483647) throw new BadRequestException("Use a positive whole-number quantity");
    if (typeof line.description !== "string" || !line.description.trim() || line.description.length > 2000) throw new BadRequestException("Provide a service description of at most 2000 characters");
    const unitPrice = money(line.unitPrice), cost = money(line.cost ?? 0);
    return { serviceId: line.serviceId, description: line.description.trim(), qty, unitPrice, amount: money(unitPrice.mul(qty)), cost: money(cost.mul(qty)) };
  });
}

export function sumMoney(values: Prisma.Decimal[]) {
  return money(values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0)));
}
