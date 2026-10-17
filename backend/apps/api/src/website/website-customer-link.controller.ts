import { BadRequestException, Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import type { AuthUser } from "../auth/auth.types";

@Controller("v1/website/customer-links")
@UseGuards(JwtAuthGuard)
export class WebsiteCustomerLinkController {
  constructor(private prisma: PrismaService) {}

  /** Staff must independently verify ownership before explicitly confirming a link. */
  @Post()
  async verify(@Body() body: { websiteCustomerId?: string; crmCustomerId?: string; ownershipVerified?: boolean }, @Req() req: { user: AuthUser }) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException();
    if (body.ownershipVerified !== true || typeof body.websiteCustomerId !== "string" || typeof body.crmCustomerId !== "string") throw new BadRequestException("Verified ownership and both account ids are required");
    return this.prisma.$transaction(async tx => {
      const website = await tx.websiteCustomer.findUnique({ where: { id: body.websiteCustomerId } });
      const crm = await tx.customer.findUnique({ where: { id: body.crmCustomerId } });
      if (!website || !crm || crm.deletedAt || website.email !== crm.email?.trim().toLowerCase()) throw new BadRequestException("Accounts do not match");
      await tx.websiteCustomer.update({ where: { id: website.id }, data: { crmCustomerId: crm.id } });
      await tx.auditLog.create({ data: { userId: req.user.id, action: "VERIFY_WEBSITE_CUSTOMER_LINK", entity: "WebsiteCustomer", entityId: website.id, after: { crmCustomerId: crm.id } } });
      return { ok: true };
    });
  }
}
