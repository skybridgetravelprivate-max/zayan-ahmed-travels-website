/** Synthetic design preview only. Never connects to a database. */
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { DocumentPdfService } from "../apps/api/src/documents/document-pdf.service";
import type { PrismaService } from "../apps/api/src/common/prisma.service";
import type { Response } from "express";

async function main() {
  const destination = process.argv[2];
  if (!destination) throw new Error("Provide a new output PDF path");
  const stream = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  const response = Object.assign(stream, { setHeader: () => undefined }) as unknown as Response;
  const service = new DocumentPdfService({ companySettings: { findFirst: async () => null } } as unknown as PrismaService);
  const modules = ["Quotation", "Umrah Booking", "Hotel Reservation", "Accommodation Voucher", "Transport Voucher", "Ticket Invoice", "Ticket Refund", "Service Invoice", "Receipt", "Visa Application Record"];
  await service.pipeA4(response, "Agency booking design preview", "INCLUDED", doc => {
    modules.forEach((module, index) => {
      if (index) doc.addPage();
      doc.font("Helvetica-Bold").fontSize(17).text(module);
      doc.font("Helvetica").fontSize(8).fillColor("#9b4b00").text("DESIGN PREVIEW - SYNTHETIC DATA - NOT A VALID BOOKING");
      service.writeKV(doc, [["Reference", `PREVIEW-${String(index + 1).padStart(3, "0")}`], ["Customer", "Synthetic Traveller"], ["Service", "Itinerary and service details appear here"], ["Status", "Design preview only"], ["Dates", "To be confirmed in the saved booking"], ["Notes", "Longer instructions wrap within the document without covering the header or footer. No customer record was read."]]);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#123e63").text("Customer summary");
      service.customerLines("INCLUDED", [{ label: "Total (PKR)", value: "0.00" }, { label: "Paid (PKR)", value: "0.00" }, { label: "Balance (PKR)", value: "0.00" }]).forEach(line => doc.font("Helvetica").fontSize(10).text(`${line.label}: ${line.value}`));
      if (index === modules.length - 1) service.writeKV(doc, Array.from({ length: 32 }, (_, i) => [`Continuation ${i + 1}`, "Synthetic continuation row for page-break verification."]));
    });
  });
  await finished(stream);
  console.log("Synthetic PDF preview created; database operations: 0");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
