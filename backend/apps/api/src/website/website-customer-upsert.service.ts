import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
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

    // An unverified email must never select or attach a CRM identity.
    throw new ForbiddenException("Staff ownership verification is required");
  }
}
