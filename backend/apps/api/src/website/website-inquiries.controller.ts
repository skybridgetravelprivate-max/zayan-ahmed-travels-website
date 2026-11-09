import { BadRequestException, Body, Controller, Headers, Post } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { SequenceService } from "../common/sequence.service";
import { assertWebsiteInternalToken, websiteInternalTokenHeaderName } from "./website-internal-token";
import { submitWebsiteInquiry } from "./inquiry-submission";

/** Narrow server-to-server intake; never accepts ownership, status, or staff permissions. */
@Controller("v1/website")
export class WebsiteInquiriesController {
  constructor(private prisma: PrismaService, private seq: SequenceService) {}

  @Post("inquiries")
  async create(
    @Body() body: Record<string, unknown>,
    @Headers(websiteInternalTokenHeaderName()) token: string | undefined,
    @Headers("idempotency-key") key?: string,
  ) {
    assertWebsiteInternalToken(token);
    const text = (key: string) => typeof body?.[key] === "string" ? (body[key] as string).trim() : "";
    const fullName = text("fullName"), mobile = text("mobile"), email = text("email"), notes = text("notes");
    if (!fullName || fullName.length > 120 || !/^[+()\d][\d\s().-]{5,39}$/.test(mobile) ||
        email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || notes.length > 6000) {
      throw new BadRequestException("Valid name, phone, email, and inquiry details are required.");
    }
    const payload = { fullName, mobile, email: email || undefined, notes, source: "WEBSITE" as const };
    return this.prisma.$transaction(async (db) => {
      const create = async () => {
        const leadNumber = await this.seq.next("lead", "ZAT-LD", db);
        const lead = await db.lead.create({
          data: { leadNumber, ...payload },
          select: { id: true },
        });
        await db.auditLog.create({ data: { action: "CREATE", entity: "Lead", entityId: lead.id } });
        return lead;
      };
      return key === undefined ? create() : submitWebsiteInquiry(db, ["internal"], key, payload, create);
    }, { isolationLevel: "ReadCommitted" });
  }
}
