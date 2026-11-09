import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { submissionId } from "../common/submission-id";

export async function submitWebsiteInquiry(
  tx: Prisma.TransactionClient,
  scope: string[],
  key: string,
  payload: object,
  create: () => Promise<{ id: string }>,
) {
  const id = submissionId("website-inquiry", scope, key);
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text`;
  const prior = await tx.auditLog.findUnique({ where: { id }, select: { entityId: true, after: true } });
  if (prior) {
    if (prior.after !== fingerprint || !prior.entityId) {
      throw new ConflictException("Idempotency key was already used for a different inquiry");
    }
    return { id: prior.entityId };
  }
  const lead = await create();
  await tx.auditLog.create({ data: { id, action: "INQUIRY_SUBMITTED", entity: "Lead", entityId: lead.id, after: fingerprint } });
  return lead;
}
