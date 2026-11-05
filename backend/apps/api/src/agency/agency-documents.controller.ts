import { Controller, Get, NotFoundException, Param, Req, Res, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../common/prisma.service";
import { AuditService } from "../common/audit.service";
import { DocumentPdfService } from "../documents/document-pdf.service";
import { agencyForUser } from "./agency-access";

@Controller("v1/agent/documents")
@UseGuards(JwtAuthGuard)
export class AgencyDocumentsController {
  constructor(private db: PrismaService, private pdf: DocumentPdfService, private audit: AuditService) {}

  private async agency(userId: string) {
    if (process.env.AGENT_DOCUMENTS_ENABLED !== "true") throw new ServiceUnavailableException("Agency document publication is not activated");
    return agencyForUser(this.db, userId);
  }

  @Get("quotation/:id")
  async quotation(@Req() req: Request & { user: AuthUser }, @Param("id") id: string, @Res() res: Response) {
    const agency = await this.agency(req.user.id);
    const quote = await this.db.quotation.findFirst({
      where: { id, agentId: agency.id, branchId: agency.branchId, status: { in: ["SENT", "ACCEPTED", "CONVERTED"] } },
      select: { id: true, quotationNumber: true, currency: true, status: true, issuedAt: true, net: true, sellingTotal: true, discount: true, tax: true,
        items: { select: { description: true, quantity: true, sellingPrice: true }, orderBy: { id: "asc" } } },
    });
    if (!quote) throw new NotFoundException();
    await this.audit.log({ userId: req.user.id, action: "agency.document-request", entity: "Quotation", entityId: quote.id });
    return this.pdf.pipeA4(res, quote.quotationNumber, "INCLUDED", doc => {
      doc.fontSize(16).text(`Quotation ${quote.quotationNumber}`);
      this.pdf.writeKV(doc, [["Agency", agency.company || agency.name], ["Currency", quote.currency], ["Status", quote.status], ["Issued", quote.issuedAt.toISOString().slice(0, 10)]]);
      for (const item of quote.items) doc.text(`${item.description}  x${item.quantity}  ${item.sellingPrice.toFixed(2)}`);
      if (doc.y + 250 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      this.pdf.writeKV(doc, [["Subtotal", quote.sellingTotal.toFixed(2)], ["Discount", quote.discount.toFixed(2)], ["Tax", quote.tax.toFixed(2)], ["Net", quote.net.toFixed(2)]]);
      doc.moveDown().text("Availability and booking confirmation require staff review.");
    }, { includeCompanyTerms: false, download: true });
  }

  @Get("umrah-booking/:id")
  async booking(@Req() req: Request & { user: AuthUser }, @Param("id") id: string, @Res() res: Response) {
    const agency = await this.agency(req.user.id);
    const booking = await this.db.umrahBooking.findFirst({
      where: { id, agentId: agency.id, branchId: agency.branchId, status: { in: ["CONFIRMED", "PROCESSING", "READY", "TRAVELING", "COMPLETED"] } },
      select: { id: true, bookingNumber: true, status: true, departureDate: true, returnDate: true, net: true, paid: true, balance: true,
        quotation: { select: { currency: true } } },
    });
    if (!booking) throw new NotFoundException();
    await this.audit.log({ userId: req.user.id, action: "agency.document-request", entity: "UmrahBooking", entityId: booking.id });
    return this.pdf.pipeA4(res, booking.bookingNumber, "INCLUDED", doc => {
      doc.fontSize(16).text(`Umrah booking ${booking.bookingNumber}`);
      this.pdf.writeKV(doc, [["Agency", agency.company || agency.name], ["Currency", booking.quotation?.currency || "Not recorded"], ["Status", booking.status],
        ["Departure", booking.departureDate?.toISOString().slice(0, 10) || "Date to be confirmed"], ["Return", booking.returnDate?.toISOString().slice(0, 10) || "Date to be confirmed"],
        ["Selling total", booking.net.toFixed(2)], ["Recorded paid", booking.paid.toFixed(2)], ["Booking balance", booking.balance.toFixed(2)]]);
      doc.moveDown().text("Selling summary. Supplier confirmation and agency statements are issued separately.");
    }, { includeCompanyTerms: false, download: true });
  }
}
