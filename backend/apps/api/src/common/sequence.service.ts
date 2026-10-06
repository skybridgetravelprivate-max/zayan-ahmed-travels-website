import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

type Db = PrismaService | { numberSequence: PrismaService["numberSequence"] };

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  async next(key: string, prefix: string, db: Db = this.prisma) {
    const year = new Date().getFullYear();
    const row = await db.numberSequence.upsert({
      where: { key: `${key}-${year}` },
      update: { current: { increment: 1 } },
      create: { key: `${key}-${year}`, prefix, year, current: 1, padLength: 6 },
    });
    const pad = row.padLength > 0 ? row.padLength : 6;
    return `${prefix}-${year}-${String(row.current).padStart(pad, "0")}`;
  }
}
