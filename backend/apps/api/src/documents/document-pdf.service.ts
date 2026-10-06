import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { PrismaService } from "../common/prisma.service";

export type PriceMode = "INCLUDED" | "EXCLUDED";

const CONFIDENTIAL = /cost|commission|profit|markup|cogs|supplier/i;

@Injectable()
export class DocumentPdfService {
  constructor(private prisma: PrismaService) {}

  async company() {
    return this.prisma.companySettings.findFirst();
  }

  parseMode(raw?: string): PriceMode {
    return String(raw || "").toUpperCase() === "EXCLUDED" ? "EXCLUDED" : "INCLUDED";
  }

  pipeA4(
    res: Response,
    filename: string,
    mode: PriceMode,
    draw: (doc: PDFKit.PDFDocument, co: { name: string; address?: string | null; phone?: string | null; email?: string | null; terms?: string | null }) => void,
  ) {
    this.company().then((co) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}.pdf"`);
      doc.pipe(res);
      const brand = {
        name: co?.companyName || "Zayan Ahmed Travels (Pvt.) Ltd.",
        address: co?.address,
        phone: co?.phone,
        email: co?.email,
        terms: co?.terms,
      };
      doc.fontSize(14).text(brand.name);
      doc.fontSize(8).fillColor("#555").text([brand.address, brand.phone, brand.email].filter(Boolean).join("  ·  "));
      doc.fillColor("#000");
      doc.fontSize(8).text(`A4  ·  ${mode === "EXCLUDED" ? "PRICE EXCLUDED" : "PRICE INCLUDED"}  ·  ${new Date().toISOString().slice(0, 10)}`);
      doc.moveDown(0.5);
      doc.strokeColor("#c79f20").lineWidth(1.5).moveTo(42, doc.y).lineTo(553, doc.y).stroke();
      doc.moveDown();
      draw(doc, brand);
      if (brand.terms) {
        doc.moveDown().fontSize(8).fillColor("#333").text("Terms", { underline: true });
        doc.fontSize(7).text(String(brand.terms).slice(0, 1200));
      }
      doc.moveDown(2);
      const y = doc.y;
      doc.fontSize(8).fillColor("#000").text("Authorized signatory", 42, y);
      doc.text("Customer / PAX acknowledgement", 320, y);
      doc.moveTo(42, y + 28).lineTo(220, y + 28).stroke();
      doc.moveTo(320, y + 28).lineTo(520, y + 28).stroke();
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        doc.fontSize(7).fillColor("#666").text(`Page ${i + 1} of ${range.count}  ·  ${brand.name}`, 42, 810, { width: 510, align: "center" });
      }
      doc.end();
    });
  }

  customerLines(mode: PriceMode, lines: { label: string; value: string }[]) {
    if (mode === "EXCLUDED") return [];
    return lines.filter((l) => !CONFIDENTIAL.test(l.label));
  }

  writeKV(doc: PDFKit.PDFDocument, rows: [string, string][]) {
    doc.fontSize(10);
    rows.forEach(([k, v]) => doc.text(`${k}: ${v || "—"}`));
  }
}
