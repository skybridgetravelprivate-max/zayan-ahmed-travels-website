import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { WhatsAppService } from "./whatsapp.service";
import { submissionId } from "./submission-id";

@Injectable()
export class OutboundMessageService {
  constructor(private db: PrismaService, private wa: WhatsAppService, private audit: AuditService) {}

  async status(userId: string, key: string) {
    const id = submissionId("whatsapp", [userId], key);
    const row = await this.db.outboundMessage.findUnique({ where: { id }, select: { id: true, status: true, providerReference: true } });
    if (!row) throw new NotFoundException("No saved submission; preserve the original request key");
    return row;
  }

  async submit(userId: string, body: { to: string; message: string }, key?: string) {
    if (typeof body?.to !== "string" || !/^\+?[0-9]{6,20}$/.test(body.to) || typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) throw new BadRequestException("Provide a phone number and message of at most 4000 characters");
    const id = submissionId("whatsapp", [userId], key);
    const fingerprint = createHash("sha256").update(JSON.stringify({ to: body.to, message: body.message })).digest("hex");
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
      const row = await tx.outboundMessage.create({ data: { id, userId, fingerprint, status: "UNCERTAIN" } });
      return { sent: false, row };
    });
    if (reserved.sent) return { id, status: "SENT", providerReference: reserved.row.providerReference };
    // Commit the uncertainty marker before crossing the provider boundary. A crash,
    // rejected response or lost DB acknowledgement never enables an automatic resend.
    const result = await this.wa.send(body.to, body.message) as { skipped?: boolean; id?: unknown };
    if (!result || typeof result !== "object" || result.skipped) throw new ServiceUnavailableException("WhatsApp delivery was not confirmed; reconcile before retrying");
    const providerReference = typeof result.id === "string" && result.id.length <= 200 ? result.id : null;
    await this.db.outboundMessage.update({ where: { id }, data: { status: "SENT", providerReference } });
    return { id, status: "SENT", providerReference };
  }

  async reconcile(userId: string, id: string, body: { status: string; reason: string; providerReference?: string }) {
    if (!["SENT", "NOT_SENT"].includes(body?.status) || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000 || (body.providerReference !== undefined && (typeof body.providerReference !== "string" || body.providerReference.length > 200))) throw new BadRequestException("Provide a confirmed delivery outcome and review reason");
    return this.db.$transaction(async tx => {
      const row = await tx.outboundMessage.findUnique({ where: { id } });
      if (!row) throw new NotFoundException();
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.fingerprint}, 6))::text`;
      const updated = await tx.outboundMessage.updateMany({ where: { id, status: "UNCERTAIN" }, data: { status: body.status, providerReference: body.providerReference ?? null } });
      if (updated.count !== 1) throw new ConflictException("This delivery is already resolved");
      await this.audit.log({ userId, action: "RECONCILE_WHATSAPP", entity: "OutboundMessage", entityId: id, reason: body.reason.trim(), after: { status: body.status }, db: tx });
      return { id, status: body.status };
    });
  }
}
