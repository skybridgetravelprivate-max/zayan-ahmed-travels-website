import { websiteImage } from "../website/website-image";
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { MAX_UPLOAD_BYTES, StorageService } from "../common/storage.service";
import { safeDownloadName } from "../common/storage-path";
import { AuditService } from "../common/audit.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import {
  authorizeDocumentOwner,
  authorizeStoredDocument,
} from "./document-scope";
import { DocumentPdfService } from "./document-pdf.service";

@Controller("v1/documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
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
    if (!file?.buffer) throw new BadRequestException("A file is required.");
    if (!q.entityType || !q.entityId)
      throw new NotFoundException("Document owner required");
    await authorizeDocumentOwner(
      this.prisma,
      req.user,
      q.entityType,
      q.entityId,
    );
    if (q.entityType === "cmsPage") {
      await this.storage.assertUploadsEnabled();
      file = await websiteImage(file);
    }
    const stored = await this.storage.put(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    try {
      const document = await this.prisma.storedDocument.create({
        data: {
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          sizeBytes: stored.size,
          storageKey: stored.key,
          entityType: q.entityType,
          entityId: q.entityId,
          uploadedById: req.user.id,
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          entityType: true,
          entityId: true,
          status: true,
          uploadedById: true,
          createdAt: true,
        },
      });
      return document;
    } catch (metadataError) {
      let persistedDocument;
      try {
        persistedDocument = await this.prisma.storedDocument.findFirst({
          where: { storageKey: stored.key },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            entityType: true,
            entityId: true,
            status: true,
            uploadedById: true,
            createdAt: true,
          },
        });
      } catch (verificationError) {
        const reason =
          verificationError instanceof Error
            ? verificationError.name
            : "UnknownError";
        this.logger.error(
          `Document metadata outcome is uncertain for storage key ${stored.key} (${reason}).`,
        );
        throw new ServiceUnavailableException(
          "Document metadata outcome is uncertain; storage reconciliation requires operator attention.",
        );
      }
      if (persistedDocument) return persistedDocument;
      try {
        await this.storage.delete(stored.key);
      } catch (cleanupError) {
        this.storage.logCleanupFailure(stored.key, cleanupError);
        throw new ServiceUnavailableException(
          "Document metadata was not saved; storage cleanup requires operator attention.",
        );
      }
      throw metadataError;
    }
  }

  @Get(":id/download")
  @RequirePermission("document.view")
  async download(
    @Param("id") id: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    const doc = await this.prisma.storedDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).send("Not found");
    await authorizeStoredDocument(this.prisma, req.user, doc);
    const buf = await this.storage.get(doc.storageKey);
    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeDownloadName(doc.fileName)}"`,
    );
    res.send(buf);
  }

  @Delete(":id")
  @RequirePermission("document.delete")
  async delete(
    @Param("id") id: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    const document = await this.prisma.storedDocument.findUnique({
      where: { id },
    });
    if (!document) throw new NotFoundException("Document not found");
    await authorizeStoredDocument(this.prisma, req.user, document);
    await this.prisma.$transaction(async (tx) => {
      if (document.entityType === "cmsPage") {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(820281)`;
        if (await tx.cmsMedia.findFirst({ where: { documentId: id } }))
          throw new BadRequestException(
            "Remove unreferenced website media through the Website library first",
          );
      }
      await tx.storedDocument.delete({ where: { id } });
      await this.audit.log({
        userId: req.user.id,
        action: "document.delete",
        entity: "StoredDocument",
        entityId: id,
        before: { mimeType: document.mimeType, sizeBytes: document.sizeBytes },
        after: { storageCleanup: "pending" },
        ipAddress: req.ip,
        db: tx,
      });
    });
    try {
      await this.storage.delete(document.storageKey);
    } catch (cleanupError) {
      this.storage.logCleanupFailure(document.storageKey, cleanupError);
      throw new ServiceUnavailableException(
        "Document record was removed; storage object cleanup requires operator attention.",
      );
    }
    try {
      await this.audit.log({
        userId: req.user.id,
        action: "document.storage_cleanup",
        entity: "StoredDocument",
        entityId: id,
        after: { status: "complete" },
        ipAddress: req.ip,
      });
    } catch (auditError) {
      const reason =
        auditError instanceof Error ? auditError.name : "UnknownError";
      this.logger.error(
        `Document deletion audit confirmation is pending for ${id} (${reason}).`,
      );
      throw new ServiceUnavailableException(
        "Document and storage object were removed; audit confirmation requires operator attention.",
      );
    }
    return { ok: true };
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
  async quotation(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "quotation", id);
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });
    if (!q) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, q.quotationNumber, m, (doc) => {
      doc.fontSize(16).text(`Quotation ${q.quotationNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", q.quotationNumber],
        ["Date", q.issuedAt?.toDateString?.() || ""],
        ["Currency", q.currency],
        ["Customer", q.customer?.fullName ?? "-"],
      ]);
      doc.moveDown();
      q.items.forEach((i) => {
        const price = m === "EXCLUDED" ? "" : `  ${i.sellingPrice.toFixed(2)}`;
        doc.text(`${i.description}  x${i.quantity}${price}`);
      });
      this.pdf
        .customerLines(m, [
          { label: "Subtotal", value: q.sellingTotal.toFixed(2) },
          { label: "Discount", value: q.discount.toFixed(2) },
          { label: "Tax", value: q.tax.toFixed(2) },
          { label: "Net", value: q.net.toFixed(2) },
        ])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("umrah-booking/:id")
  async umrahBooking(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "umrahBooking", id);
    const b = await this.prisma.umrahBooking.findUnique({
      where: { id },
      include: { customer: true, passengers: { include: { passenger: true } } },
    });
    if (!b) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, b.bookingNumber, m, (doc) => {
      doc.fontSize(16).text(`Umrah Booking ${b.bookingNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", b.bookingNumber],
        ["Date", b.createdAt.toDateString()],
        ["Customer", b.customer.fullName],
        ["Departure", b.departureDate?.toDateString() || "-"],
        ["Return", b.returnDate?.toDateString() || "-"],
      ]);
      (b.passengers || []).forEach((p) =>
        doc.text(`PAX: ${p.passenger?.fullName || p.passengerId}`),
      );
      this.pdf
        .customerLines(m, [
          { label: "Selling", value: b.sellingPrice.toFixed(2) },
          { label: "Discount", value: b.discount.toFixed(2) },
          { label: "Tax", value: b.tax.toFixed(2) },
          { label: "Net", value: b.net.toFixed(2) },
          { label: "Paid", value: b.paid.toFixed(2) },
          { label: "Balance", value: b.balance.toFixed(2) },
        ])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("umrah-voucher/:id")
  async umrahVoucher(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.umrahBooking(id, mode, res, req);
  }

  @Get("hotel-voucher/:id")
  async hotelVoucher(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "hotelVoucher", id);
    const v = await this.prisma.hotelVoucher.findUnique({
      where: { id },
      include: { booking: { include: { hotel: true, customer: true } } },
    });
    if (!v) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, v.voucherNo, m, (doc) => {
      doc.fontSize(16).text(`Accommodation Voucher ${v.voucherNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", v.voucherNo],
        ["Hotel", v.booking.hotel.name],
        [
          "Dates",
          `${v.booking.checkIn.toDateString()} - ${v.booking.checkOut.toDateString()}`,
        ],
        ["Customer / PAX", v.booking.customer?.fullName ?? "-"],
      ]);
    });
  }

  @Get("hotel-reservation/:id")
  async hotelReservation(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "hotelBooking", id);
    const b = await this.prisma.hotelBooking.findUnique({
      where: { id },
      include: {
        hotel: true,
        customer: true,
        staySegments: { orderBy: { checkIn: "asc" }, include: { hotel: true, rooms: { orderBy: { id: "asc" }, include: { pax: { include: { passenger: true } } } } } },
      },
    });
    if (!b) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, b.bookingNumber, m, (doc) => {
      doc.fontSize(16).text(`Hotel Reservation ${b.bookingNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", b.bookingNumber],
        ["Hotel", b.hotel?.name],
        ["Check-in", b.checkIn?.toDateString?.() || ""],
        ["Check-out", b.checkOut?.toDateString?.() || ""],
        ["Customer", b.customer?.fullName ?? "-"],
      ]);
      for (const [index, segment] of b.staySegments.entries()) {
        this.pdf.writeKV(doc, [
          [`Stay ${index + 1}`, `${segment.hotel.name} | ${segment.checkIn.toISOString().slice(0, 10)} to ${segment.checkOut.toISOString().slice(0, 10)}`],
          ...segment.rooms.filter(room => room.status !== "TRANSFERRED").map((room, roomIndex): [string, string] => [
            `Room ${roomIndex + 1}`,
            `${room.roomNumber || "Number to be confirmed"} | ${room.status} | Guests: ${room.pax.map(pax => pax.passenger.fullName).join(", ") || "Not allocated"}`,
          ]),
        ]);
      }
      this.pdf.writeKV(doc, this.pdf.customerLines(m, [
        { label: "Selling", value: b.sellingPrice.toFixed(2) },
        { label: "Discount", value: b.discount.toFixed(2) },
        { label: "Tax", value: b.tax.toFixed(2) },
        { label: "Net total", value: b.net.toFixed(2) },
        { label: "Paid", value: b.paid.toFixed(2) },
        { label: "Balance", value: b.balance.toFixed(2) },
      ]).map(line => [line.label, line.value]));
      doc.fontSize(8).text("Agency reservation record. Supplier confirmation and settlement are separate.");
    });
  }

  @Get("transport-voucher/:id")
  async transportVoucher(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "transportVoucher", id);
    const v = await this.prisma.transportVoucher.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!v) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, v.voucherNo, m, (doc) => {
      doc.fontSize(16).text(`Transport Voucher ${v.voucherNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", v.voucherNo],
        ["Route", `${v.booking.pickup} -> ${v.booking.dropoff}`],
      ]);
    });
  }

  @Get("transport-booking/:id")
  async transportBooking(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "transportBooking", id);
    const booking = await this.prisma.transportBooking.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!booking) return res.status(404).send("Not found");
    const priceMode = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, booking.bookingNumber, priceMode, (doc) => {
      doc.fontSize(16).text(`Transport Booking ${booking.bookingNumber}`);
      this.pdf.writeKV(doc, [
        ["Reference", booking.bookingNumber],
        ["Customer", booking.customer?.fullName || "-"],
        ["Pickup", booking.pickup || "-"],
        ["Drop-off", booking.dropoff || "-"],
        ["Trip date", booking.tripDate.toDateString()],
        ["Passengers", String(booking.paxCount)],
        ["Status", booking.status],
      ]);
      this.pdf
        .customerLines(priceMode, [
          { label: "Total", value: String(booking.net) },
          { label: "Paid", value: String(booking.paid) },
        ])
        .forEach((line) => doc.text(`${line.label}: ${line.value}`));
    });
  }

  @Get("ticket-invoice/:id")
  async ticketInvoice(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "ticketSale", id);
    const t = await this.prisma.ticketSale.findUnique({
      where: { id },
      include: { customer: true, passenger: true, airline: true },
    });
    if (!t) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, t.ticketNumber || t.id, m, (doc) => {
      doc.fontSize(16).text(`Ticket Invoice ${t.ticketNumber || t.id}`);
      this.pdf.writeKV(doc, [
        ["PNR / ticket", `${t.pnrId || "-"} / ${t.ticketNumber || "-"}`],
        ["Customer", t.customer?.fullName ?? t.passenger?.fullName ?? "-"],
        ["Airline", t.airline?.name || t.flightNumber || "-"],
        ["Sector", t.sector || "-"],
        ["Currency", t.currency],
      ]);
      this.pdf
        .customerLines(m, [
          { label: "Fare", value: String(t.fare) },
          { label: "Tax", value: String(t.tax) },
          { label: "Net", value: String(t.net) },
          { label: "Paid", value: String(t.paidAmount) },
        ])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("ticket-refund/:id")
  async ticketRefund(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "ticketRefund", id);
    const r = await this.prisma.ticketRefund.findUnique({
      where: { id },
      include: { ticket: { include: { customer: true } } },
    });
    if (!r) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, r.id, m, (doc) => {
      doc.fontSize(16).text(`Ticket Refund ${r.id}`);
      this.pdf.writeKV(doc, [
        ["Ticket", r.ticket.ticketNumber || r.ticketId],
        ["Customer", r.ticket.customer?.fullName ?? "-"],
        ["Reason", r.reason || "-"],
        ["Date", r.refundedAt.toDateString()],
      ]);
      this.pdf
        .customerLines(m, [
          { label: "Refund amount", value: String(r.refundAmount) },
          { label: "Net refund", value: String(r.netRefund) },
        ])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("service-invoice/:id")
  async serviceInvoice(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "serviceInvoice", id);
    const inv = await this.prisma.serviceInvoice.findUnique({
      where: { id },
      include: { customer: true, lines: true },
    });
    if (!inv) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, inv.invoiceNumber, m, (doc) => {
      doc.fontSize(16).text(`Service Invoice ${inv.invoiceNumber}`);
      this.pdf.writeKV(doc, [
        ["Document no.", inv.invoiceNumber],
        ["Date", inv.date.toDateString()],
        ["Customer", inv.customer?.fullName ?? "-"],
      ]);
      inv.lines.forEach((l) =>
        doc.text(
          `${l.description}  x${l.qty}${m === "EXCLUDED" ? "" : "  " + l.amount}`,
        ),
      );
      this.pdf
        .customerLines(m, [{ label: "Net", value: String(inv.net) }])
        .forEach((x) => doc.text(`${x.label}: ${x.value}`));
    });
  }

  @Get("receipt/:id")
  async receipt(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "receipt", id);
    const r = await this.prisma.receipt.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!r) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, r.receiptNo, m, (doc) => {
      doc.fontSize(16).text(`Receipt ${r.receiptNo}`);
      this.pdf.writeKV(doc, [
        ["Document no.", r.receiptNo],
        ["Date", r.date.toDateString()],
        ["Customer", r.customer?.fullName ?? "-"],
        ["Method", r.method],
      ]);
      this.pdf
        .customerLines(m, [{ label: "Amount", value: r.amount.toFixed(2) }])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("visa-application/:id")
  async visaApplication(
    @Param("id") id: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "visaApplication", id);
    const application = await this.prisma.visaApplication.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!application) return res.status(404).send("Not found");
    return this.pdf.pipeA4(
      res,
      application.applicationNo,
      "EXCLUDED",
      (doc) => {
        doc.fontSize(16).text(`Visa Application ${application.applicationNo}`);
        this.pdf.writeKV(doc, [
          ["Reference", application.applicationNo],
          ["Customer", application.customer?.fullName || "-"],
          ["Destination", application.country],
          ["Category", application.category],
          ["Status", application.status],
        ]);
        doc
          .fontSize(9)
          .text(
            "Application record only. This is not a visa or a guarantee of approval.",
          );
      },
    );
  }

  @Get("salary-slip/:id")
  async salary(
    @Param("id") id: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    await authorizeDocumentOwner(this.prisma, req.user, "salarySlip", id);
    const s = await this.prisma.salarySlip.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!s) return res.status(404).send("Not found");
    const m = this.pdf.parseMode(mode);
    return this.pdf.pipeA4(res, s.slipNo, m, (doc) => {
      doc.fontSize(16).text(`Salary Slip ${s.slipNo}`);
      doc.text(s.employee.fullName);
      this.pdf
        .customerLines(m, [{ label: "Net", value: String(s.net) }])
        .forEach((l) => doc.text(`${l.label}: ${l.value}`));
    });
  }

  @Get("invoice/:bookingId")
  async invoice(
    @Param("bookingId") bookingId: string,
    @Query("mode") mode: string,
    @Res() res: Response,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.umrahBooking(bookingId, mode, res, req);
  }
}
