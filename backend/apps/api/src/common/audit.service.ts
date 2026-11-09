import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

type Db = PrismaService | { auditLog: PrismaService["auditLog"] };

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    id?: string;
    userId?: string;
    action: string;
    reason?: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
    db?: Db;
  }) {
    const db = params.db ?? this.prisma;
    await db.auditLog.create({
      data: {
        id: params.id,
        userId: params.userId,
        action: params.action,
        reason: params.reason,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before as object | undefined,
        after: params.after as object | undefined,
        ipAddress: params.ipAddress,
      },
    });
  }
}
