import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { assertPasswordPolicy, hashPassword } from "../common/password";
import { MailService } from "../common/mail.service";
import {
  assertWebsiteInternalToken,
  websiteInternalTokenHeaderName,
} from "./website-internal-token";

const genericRequestResponse = { ok: true };
const invalidResetResponse = "This recovery link is invalid, expired or already used.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Controller("v1/customer")
export class WebsiteCustomerRecoveryController {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  @Post("forgot-password")
  async forgot(
    @Body() body: { email?: string },
    @Headers(websiteInternalTokenHeaderName()) internalToken: string | undefined,
  ) {
    assertWebsiteInternalToken(internalToken);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !emailPattern.test(email)) {
      throw new BadRequestException("Enter a valid email address.");
    }

    if (!process.env.SMTP_HOST) {
      throw new ServiceUnavailableException("Customer recovery email is unavailable.");
    }
    const origin = process.env.SITE_URL || (process.env.APP_URL ?? "").split(",")[0].trim();
    let link: URL;
    try {
      link = new URL("/account/reset-password", origin);
    } catch {
      throw new ServiceUnavailableException("Customer recovery is unavailable.");
    }
    const localHttp = process.env.NODE_ENV !== "production" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(link.hostname);
    if ((link.protocol !== "https:" && !(link.protocol === "http:" && localHttp)) || link.username || link.password) {
      throw new ServiceUnavailableException("Customer recovery is unavailable.");
    }

    const customer = await this.prisma.websiteCustomer.findUnique({ where: { email } });
    if (!customer) return genericRequestResponse;

    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const resetToken = await this.prisma.$transaction(async tx => {
      await tx.websiteCustomerPasswordResetToken.updateMany({
        where: { customerId: customer.id, usedAt: null },
        data: { usedAt: now },
      });
      return tx.websiteCustomerPasswordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      });
    });

    link.searchParams.set("token", token);
    let accepted = false;
    try {
      const delivery = await this.mail.send(
        email,
        "Reset your customer account password",
        `<p>Reset your customer account password using this link: <a href="${link}">${link}</a></p>`,
      );
      const result = delivery as { skipped?: boolean; accepted?: unknown[] };
      accepted = !result.skipped && Array.isArray(result.accepted) && result.accepted.length > 0;
    } catch {
      console.warn("Website customer recovery email delivery failed");
    }
    if (!accepted) {
      await this.prisma.websiteCustomerPasswordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    return genericRequestResponse;
  }

  @Post("reset-password")
  async reset(
    @Body() body: { token?: string; password?: string },
    @Headers(websiteInternalTokenHeaderName()) internalToken: string | undefined,
  ) {
    assertWebsiteInternalToken(internalToken);
    if (
      typeof body?.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(body.token) ||
      typeof body.password !== "string" ||
      !body.password
    ) {
      throw new BadRequestException(invalidResetResponse);
    }
    assertPasswordPolicy(body.password);

    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const lookupTime = new Date();
    const resetToken = await this.prisma.websiteCustomerPasswordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: lookupTime } },
    });
    if (!resetToken) throw new BadRequestException(invalidResetResponse);

    const passwordHash = await hashPassword(body.password);
    await this.prisma.$transaction(async tx => {
      const now = new Date();
      const claimed = await tx.websiteCustomerPasswordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException(invalidResetResponse);

      await tx.websiteCustomer.update({
        where: { id: resetToken.customerId },
        data: { passwordHash, updatedAt: now },
      });
      await tx.websiteCustomerSession.updateMany({
        where: { customerId: resetToken.customerId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.websiteCustomerPasswordResetToken.updateMany({
        where: { customerId: resetToken.customerId, usedAt: null },
        data: { usedAt: now },
      });
    });

    return { ok: true };
  }
}
