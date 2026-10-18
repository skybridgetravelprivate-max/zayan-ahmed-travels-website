import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { MAX_UPLOAD_BYTES, StorageService } from "../common/storage.service";
import { safeDownloadName } from "../common/storage-path";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { NotFoundException } from "@nestjs/common";
import { authorizeDocumentOwner, authorizeStoredDocument } from "./document-scope";
import { DocumentPdfService } from "./document-pdf.service";

@Controller("v1/documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentsController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Post("upload")
  @RequirePermission("document.create")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query() q: { entityType?: string; entityId?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    if (!q.entityType || !q.entityId) throw new NotFoundException("Document owner required");
    await authorizeDocumentOwner(this.prisma, req.user, q.entityType, q.entityId);
    const stored = await this.storage.put(file.buffer, file.originalname, file.mimetype);
    return this.prisma.storedDocument.create({
      data: {
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.size,
        storageKey: stored.key,
        entityType: q.entityType,
        entityId: q.entityId,
        uploadedById: req.user.id,
      },
    });
  }

  @Get(":id/download")
  @RequirePermission("document.view")
  async download(@Param("id") id: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    const doc = await this.prisma.storedDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).send("Not found");
    await authorizeStoredDocument(this.prisma, req.user, doc);
    const buf = await this.storage.get(doc.storageKey);
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName(doc.fileName)}"`);
    res.send(buf);
  }
}

@Controller("v1/pdf")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("document.view")
export class PdfController {
  constructor(
    private prisma: PrismaService,
    private pdf: DocumentPdfService,
  ) {}

  @Get("quotation/:id")
  async quotation(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "quotation", id);
    const q = await this.prisma.quotation.findUnique({ where: { id }, include: { items: true, customer: true } });
    if (!q) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, q.quotationNumber, m, (doc) => {
      doc.fontSize(16).text(`Quotation ${q.quotationNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", q.quotationNumber],
        ["Date", q.issuedAt?.toDateString?.() || ""],
        ["Customer", q.customer?.fullName ?? "-"],
      ]);
      doc.moveDown();
      q.items.forEach((i) => {
        const price = m === "EXCLUDED" ? "" : `  ${i.sellingPrice}`;
        doc.text(`${i.description}  x${i.quantity}${price}`);
      });
      this.pdf.customerLines(m, [{ label: "Net", value: String(q.net) }]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("umrah-booking/:id")
  async umrahBooking(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "umrahBooking", id);
    const b = await this.prisma.umrahBooking.findUnique({
      where: { id },
      include: { customer: true, passengers: { include: { passenger: true } } },
    });
    if (!b) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, b.bookingNumber, m, (doc) => {
      doc.fontSize(16).text(`Umrah Booking ${b.bookingNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", b.bookingNumber],
        ["Date", b.createdAt.toDateString()],
        ["Customer", b.customer.fullName],
        ["Departure", b.departureDate?.toDateString() || "—"],
        ["Return", b.returnDate?.toDateString() || "—"],
      ]);
      (b.passengers || []).forEach((p) => doc.text(`PAX: ${p.passenger?.fullName || p.passengerId}`));
      this.pdf.customerLines(m, [
        { label: "Selling", value: String(b.sellingPrice) },
        { label: "Paid", value: String(b.paid) },
        { label: "Balance", value: String(b.balance) },
      ]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("umrah-voucher/:id")
  async umrahVoucher(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    return this.umrahBooking(id, mode, res, req);
  }

  @Get("hotel-voucher/:id")
  async hotelVoucher(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "hotelVoucher", id);
    const v = await this.prisma.hotelVoucher.findUnique({
      where: { id },
      include: { booking: { include: { hotel: true, customer: true } } },
    });
    if (!v) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, v.voucherNo, m, (doc) => {
      doc.fontSize(16).text(`Accommodation Voucher ${v.voucherNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", v.voucherNo],
        ["Hotel", v.booking.hotel.name],
        ["Dates", `${v.booking.checkIn.toDateString()} - ${v.booking.checkOut.toDateString()}`],
        ["Customer / PAX", v.booking.customer?.fullName ?? "-"],
      ]);
    });
  }

  @Get("hotel-reservation/:id")
  async hotelReservation(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "hotelBooking", id);
    const b = await this.prisma.hotelBooking.findUnique({
      where: { id },
      include: { hotel: true, customer: true, staySegments: { include: { rooms: true } } },
    });
    if (!b) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, b.bookingNumber, m, (doc) => {
      doc.fontSize(16).text(`Hotel Reservation ${b.bookingNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", b.bookingNumber],
        ["Hotel", b.hotel?.name],
        ["Check-in", b.checkIn?.toDateString?.() || ""],
        ["Check-out", b.checkOut?.toDateString?.() || ""],
        ["Customer", b.customer?.fullName ?? "-"],
      ]);
      this.pdf.customerLines(m, [
        { label: "Selling", value: String(b.sellingPrice) },
      ]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("transport-voucher/:id")
  async transportVoucher(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "transportVoucher", id);
    const v = await this.prisma.transportVoucher.findUnique({ where: { id }, include: { booking: true } });
    if (!v) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, v.voucherNo, m, (doc) => {
      doc.fontSize(16).text(`Transport Voucher ${v.voucherNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", v.voucherNo],
        ["Route", `${v.booking.pickup} → ${v.booking.dropoff}`],
      ]);
    });
  }

  @Get("ticket-invoice/:id")
  async ticketInvoice(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "ticketSale", id);
    const t = await this.prisma.ticketSale.findUnique({ where: { id }, include: { customer: true, passenger: true, airline: true } });
    if (!t) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, t.ticketNumber || t.id, m, (doc) => {
      doc.fontSize(16).text(`Ticket Invoice ${t.ticketNumber || t.id}`);
      this.pdf.writeKV(doc, [
        ["PNR / ticket", `${t.pnrId || "—"} / ${t.ticketNumber || "—"}`],
        ["Customer", t.customer?.fullName ?? t.passenger?.fullName ?? "-"],
        ["Airline", t.airline?.name || t.flightNumber || "—"],
        ["Sector", t.sector || "—"],
      ]);
      this.pdf.customerLines(m, [
        { label: "Fare", value: String(t.fare) },
        { label: "Tax", value: String(t.tax) },
        { label: "Net", value: String(t.net) },
        { label: "Paid", value: String(t.paidAmount) },
      ]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("ticket-refund/:id")
  async ticketRefund(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "ticketRefund", id);
    const r = await this.prisma.ticketRefund.findUnique({ where: { id }, include: { ticket: { include: { customer: true } } } });
    if (!r) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, r.id, m, (doc) => {
      doc.fontSize(16).text(`Ticket Refund ${r.id}`);
      this.pdf.writeKV(doc, [
        ["Ticket", r.ticket.ticketNumber || r.ticketId],
        ["Customer", r.ticket.customer?.fullName ?? "-"],
        ["Reason", r.reason || "—"],
        ["Date", r.refundedAt.toDateString()],
      ]);
      this.pdf.customerLines(m, [
        { label: "Refund amount", value: String(r.refundAmount) },
        { label: "Net refund", value: String(r.netRefund) },
      ]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("service-invoice/:id")
  async serviceInvoice(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "serviceInvoice", id);
    const inv = await this.prisma.serviceInvoice.findUnique({ where: { id }, include: { customer: true, lines: true } });
    if (!inv) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, inv.invoiceNumber, m, (doc) => {
      doc.fontSize(16).text(`Service Invoice ${inv.invoiceNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", inv.invoiceNumber],
        ["Date", inv.date.toDateString()],
        ["Customer", inv.customer?.fullName ?? "-"],
      ]);
      inv.lines.forEach((l) => doc.text(`${l.description}  x${l.qty}${m === "EXCLUDED" ? "" : "  " + l.amount}`));
      this.pdf.customerLines(m, [{ label: "Net", value: String(inv.net) }]).forEach((x) => doc.text(`${x.label}: ${x.value}`));
    });
  }

  @Get("receipt/:id")
  async receipt(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "receipt", id);
    const r = await this.prisma.receipt.findUnique({ where: { id }, include: { customer: true } });
    if (!r) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, r.receiptNo, m, (doc) => {
      doc.fontSize(16).text(`Receipt ${r.receiptNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", r.receiptNo],
        ["Date", r.date.toDateString()],
        ["Customer", r.customer?.fullName ?? "-"],
        ["Method", r.method],
      ]);
      this.pdf.customerLines(m, [{ label: "Amount", value: String(r.amount) }]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("salary-slip/:id")
  async salary(@Param("id") id: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    await authorizeDocumentOwner(this.prisma, req.user, "salarySlip", id);
    const s = await this.prisma.salarySlip.findUnique({ where: { id }, include: { employee: true } });
    if (!s) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    this.pdf.pipeA4(res, s.slipNo, m, (doc) => {
      doc.fontSize(16).text(`Salary Slip ${s.slipNo}`);
      doc.text(s.employee.fullName);
      this.pdf.customerLines(m, [{ label: "Net", value: String(s.net) }]).forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("invoice/:bookingId")
  async invoice(@Param("bookingId") bookingId: string, @Query("mode") mode: string, @Res() res: Response, @Req() req: Request & { user: AuthUser }) {
    return this.umrahBooking(bookingId, mode, res, req);
  }
}
