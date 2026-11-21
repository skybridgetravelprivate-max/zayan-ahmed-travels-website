import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { WhatsAppService } from "./whatsapp.service";
import { submissionId } from "./submission-id";
import { MailService } from "./mail.service";

@Injectable()
export class OutboundMessageService {
  constructor(private db: PrismaService, private wa: WhatsAppService, private audit: AuditService, private mail: MailService) {}

  async status(userId: string, key: string, channel: "WHATSAPP" | "EMAIL" = "WHATSAPP") {
    const id = submissionId(channel.toLowerCase(), [userId], key);
    const row = await this.db.outboundMessage.findUnique({ where: { id }, select: { id: true, status: true, providerReference: true } });
    if (!row) throw new NotFoundException("No saved submission; preserve the original request key");
    return row;
  }

  async submit(userId: string, body: { to: string; message: string }, key?: string) {
    if (typeof body?.to !== "string" || !/^\+?[0-9]{6,20}$/.test(body.to) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) throw new BadRequestException("Provide a phone number and message of at most 4000 characters");
    const fingerprint = createHash("sha256").update(JSON.stringify({ to: body.to, message: body.message })).digest("hex");
    return this.deliver(userId, "WHATSAPP", fingerprint, key, async () => {
      const result = await this.wa.send(body.to, body.message) as { skipped?: boolean; id?: unknown };
      if (!result || typeof result !== "object" || result.skipped) throw new ServiceUnavailableException("WhatsApp delivery was not confirmed; reconcile before retrying");
      return typeof result.id === "string" && result.id.length <= 200 ? result.id : null;
    });
  }

  async submitEmail(userId: string, body: { to: string; subject: string; html: string }, key?: string) {
    if (typeof body?.to !== "string" || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(body.to) || body.to.length > 254 || typeof body.subject !== "string" || !body.subject.trim() || body.subject.length > 998 || /[\r\n]/.test(body.subject) || typeof body.html !== "string" || !body.html.trim() || body.html.length > 100000) throw new BadRequestException("Provide one email address, a subject and email content");
    const fingerprint = createHash("sha256").update(JSON.stringify({ channel: "EMAIL", to: body.to, subject: body.subject, html: body.html })).digest("hex");
    const id = submissionId("email", [userId], key);
    return this.deliver(userId, "EMAIL", fingerprint, key, async () => {
      try {
        const result = await this.mail.send(body.to, body.subject, body.html, `<${id.slice(6)}@zayanahmedtravels.com>`) as { skipped?: boolean; accepted?: unknown[]; messageId?: unknown };
        if (result?.skipped || !Array.isArray(result?.accepted) || !result.accepted.some(address => typeof address === "string" && address.toLowerCase() === body.to.toLowerCase())) throw Error("No acceptance");
        return typeof result.messageId === "string" && result.messageId.length <= 200 ? result.messageId : null;
      } catch {
        // SMTP errors can contain credentials, destination addresses and server replies.
        throw new ServiceUnavailableException("Email acceptance was not confirmed; reconcile before retrying");
      }
    });
  }

  private async deliver(userId: string, channel: "WHATSAPP" | "EMAIL", fingerprint: string, key: string | undefined, send: () => Promise<string | null>) {
    const id = submissionId(channel.toLowerCase(), [userId], key);
    const reserved = await this.db.$transaction(async tx => {
      // Different payloads sharing a request key must serialize before the first
      // lookup, even though they acquire different content locks below.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 7))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint}, 6))::text`;
      const previous = await tx.outboundMessage.findUnique({ where: { id } });
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ConflictException("Message key belongs to different content");
        if (previous.status !== "SENT") throw new ConflictException("Delivery requires review; do not resend automatically");
        return { sent: true, row: previous };
      }
      if (await tx.outboundMessage.findFirst({ where: { fingerprint, status: "UNCERTAIN" } })) throw new ConflictException("An identical message has an uncertain delivery; reconcile before sending again");
      const row = await tx.outboundMessage.create({ data: { id, userId, channel, fingerprint, status: "UNCERTAIN" } });
      return { sent: false, row };
    });
    if (reserved.sent) return { id, status: "SENT", providerReference: reserved.row.providerReference };
    // Commit the uncertainty marker before crossing the provider boundary. A crash,
    // rejected response or lost DB acknowledgement never enables an automatic resend.
    const providerReference = await send();
    const updated = await this.db.outboundMessage.updateMany({ where: { id, status: "UNCERTAIN" }, data: { status: "SENT", providerReference } });
    if (updated.count !== 1) throw new ConflictException("Delivery outcome changed during submission; review before retrying");
    return { id, status: "SENT", providerReference };
  }

  async reconcile(userId: string, id: string, body: { status: string; reason: string; providerReference?: string }, channel: "WHATSAPP" | "EMAIL" = "WHATSAPP") {
    if (!["SENT", "NOT_SENT"].includes(body?.status) || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000 || (body.providerReference !== undefined && (typeof body.providerReference !== "string" || body.providerReference.length > 200))) throw new BadRequestException("Provide a confirmed delivery outcome and review reason");
    return this.db.$transaction(async tx => {
      const row = await tx.outboundMessage.findUnique({ where: { id } });
      if (!row || row.channel !== channel) throw new NotFoundException();
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.fingerprint}, 6))::text`;
      const updated = await tx.outboundMessage.updateMany({ where: { id, status: "UNCERTAIN" }, data: { status: body.status, providerReference: body.providerReference ?? null } });
      if (updated.count !== 1) throw new ConflictException("This delivery is already resolved");
      await this.audit.log({ userId, action: `RECONCILE_${channel}`, entity: "OutboundMessage", entityId: id, reason: body.reason.trim(), after: { status: body.status }, db: tx });
      return { id, status: body.status };
    });
  }
}
