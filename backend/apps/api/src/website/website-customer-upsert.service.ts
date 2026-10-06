import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";

export function normalizeWebsiteCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

@Injectable()
export class WebsiteCustomerUpsertService {
  constructor(
    private prisma: PrismaService,
    private seq: SequenceService,
  ) {}

  async upsertByEmail(input: { email?: string; fullName?: string }): Promise<{ id: string }> {
    const email = normalizeWebsiteCustomerEmail(input.email ?? "");
    if (!email || email.length > 254 || !email.includes("@")) {
      throw new BadRequestException("email is required");
    }

    const existing = await this.prisma.customer.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id };
    }

    const fullNameRaw = (input.fullName ?? "").trim();
    const fullName = (fullNameRaw || email.split("@")[0] || "Website customer").slice(0, 200);
    const customerNumber = await this.seq.next("customer", "ZAT-CUS");

    try {
      const created = await this.prisma.customer.create({
        data: {
          customerNumber,
          fullName,
          email,
        },
        select: { id: true },
      });
      return { id: created.id };
    } catch (error) {
      // Race: another request created the same email.
      const again = await this.prisma.customer.findFirst({
        where: { email, deletedAt: null },
        select: { id: true },
      });
      if (again) return { id: again.id };
      throw error;
    }
  }
}
