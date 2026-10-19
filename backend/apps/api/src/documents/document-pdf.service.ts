import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { safeDownloadName } from "../common/storage-path";
import { agencyBrand } from "../../../../packages/config/agency-brand.cjs";

export type PriceMode = "INCLUDED" | "EXCLUDED";
type Brand = { name: string; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; terms?: string | null };
const CONFIDENTIAL = /cost|commission|profit|markup|cogs|supplier/i;
const blue = "#123e63";

@Injectable()
export class DocumentPdfService {
  constructor(private prisma: PrismaService) {}
  async company() { return this.prisma.companySettings.findFirst(); }
  parseMode(raw?: string): PriceMode { return String(raw || "").toUpperCase() === "EXCLUDED" ? "EXCLUDED" : "INCLUDED"; }

  async pipeA4(res: Response, filename: string, mode: PriceMode, draw: (doc: PDFKit.PDFDocument, co: Brand) => void) {
    const co = await this.company();
    const brand: Brand = {
      name: co?.companyName?.trim() || agencyBrand.name,
      address: co?.address?.trim() || agencyBrand.address,
      phone: co?.phone?.trim() || agencyBrand.phone,
      email: co?.email?.trim() || agencyBrand.email,
      website: co?.website?.trim() || agencyBrand.website,
      terms: co?.terms,
    };
    const doc = new PDFDocument({ size: "A4", margins: { top: 166, bottom: 64, left: 42, right: 42 }, bufferPages: true, info: { Title: filename, Author: brand.name } });
    const header = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, 80).fill(blue);
      doc.roundedRect(42, 22, 38, 38, 8).lineWidth(1).strokeColor("#e9953b").stroke();
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#f6a34b").text("ZA", 49, 33, { width: 28, lineBreak: false });
      doc.fillColor("#ffffff").fontSize(14).text(brand.name, 94, 24, { width: 459, height: 32, ellipsis: true });
      doc.font("Helvetica").fontSize(8).fillColor("#e1eaf1").text(agencyBrand.tagline, 94, 60, { width: 459 });
      doc.fillColor("#455668").fontSize(8).text(brand.address || "", 42, 93, { width: 511, height: 20, ellipsis: true });
      doc.fontSize(7.5).text([brand.phone, brand.email, brand.website].filter(Boolean).join("  |  "), 42, 117, { width: 511, height: 18, ellipsis: true });
      doc.fillColor(blue).fontSize(8).text(`${mode === "EXCLUDED" ? "PRICE EXCLUDED" : "PRICE INCLUDED"}  |  Generated ${new Date().toISOString().slice(0, 10)} (UTC)`, 42, 141, { width: 511 });
      doc.moveTo(42, 155).lineTo(553, 155).strokeColor("#e9953b").lineWidth(2).stroke();
      doc.restore(); doc.x = 42; doc.y = 172; doc.font("Helvetica").fontSize(10).fillColor("#172536");
    };
    header(); doc.on("pageAdded", header);
    try {
      draw(doc, brand);
      if (brand.terms) {
        doc.moveDown().font("Helvetica-Bold").fontSize(9).fillColor(blue).text("Terms & instructions");
        doc.font("Helvetica").fontSize(8).fillColor("#455668").text(String(brand.terms).slice(0, 1200));
      }
      const signatureHeight = doc.currentLineHeight() * 2 + 44;
      if (doc.y + signatureHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
      doc.moveDown(2);
      const y = doc.y;
      doc.moveTo(42, y + 25).lineTo(232, y + 25).strokeColor("#8998a6").lineWidth(0.6).stroke();
      doc.moveTo(330, y + 25).lineTo(553, y + 25).stroke();
      doc.font("Helvetica").fontSize(8).fillColor(blue).text("Authorized agency signatory", 42, y + 32, { width: 190 });
      doc.text("Customer / traveller acknowledgement", 330, y + 32, { width: 223 });
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(42, doc.page.height - 47).lineTo(553, doc.page.height - 47).strokeColor("#d9e2e9").stroke();
        doc.font("Helvetica").fontSize(7).fillColor("#617182").text(`${brand.name}  |  Page ${i + 1} of ${range.count}`, 42, doc.page.height - 35, { width: 511, align: "center", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
    } catch (error) { doc.destroy(); throw error; }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeDownloadName(filename)}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    doc.on("error", () => res.destroy());
    doc.pipe(res); doc.end();
  }

  customerLines(mode: PriceMode, lines: { label: string; value: string }[]) {
    return mode === "EXCLUDED" ? [] : lines.filter(line => !CONFIDENTIAL.test(line.label));
  }
  writeKV(doc: PDFKit.PDFDocument, rows: [string, string][]) {
    doc.moveDown(0.5);
    for (const [label, value] of rows) {
      const text = value || "-";
      if (text.length > 400) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(blue).text(label.toUpperCase());
        doc.font("Helvetica").fontSize(10).fillColor("#172536").text(text).moveDown(0.5);
        continue;
      }
      doc.font("Helvetica").fontSize(10);
      const height = Math.max(22, doc.heightOfString(text, { width: 352 }) + 12, doc.heightOfString(label, { width: 135 }) + 12);
      if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
      const y = doc.y;
      doc.rect(42, y, 511, height).fill("#f1f5f8");
      doc.font("Helvetica-Bold").fontSize(8).fillColor(blue).text(label, 51, y + 6, { width: 126 });
      doc.font("Helvetica").fontSize(10).fillColor("#172536").text(text, 192, y + 5, { width: 352 });
      doc.x = 42; doc.y = y + height + 3;
    }
    doc.font("Helvetica").fontSize(10).fillColor("#172536").moveDown(0.5);
  }
}
