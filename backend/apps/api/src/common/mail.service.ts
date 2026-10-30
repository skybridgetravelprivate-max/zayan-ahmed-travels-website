import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { agencyBrand } from "../../../../packages/config/agency-brand.cjs";

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });

  async send(to: string, subject: string, html: string) {
    if (!process.env.SMTP_HOST) {
      console.warn("SMTP not configured; email skipped");
      return { skipped: true };
    }
    return this.transporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || agencyBrand.email,
      to,
      subject,
      html,
    });
  }
}
