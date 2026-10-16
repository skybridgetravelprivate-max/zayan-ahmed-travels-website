import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService, sanitizeDbError } from "./common/prisma.service";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private prisma: Pick<PrismaService, "ping">) {}

  @Get("health")
  async health() {
    let db = false;
    let dbError: string | undefined;
    try {
      await this.prisma.ping();
      db = true;
    } catch (err) {
      db = false;
      dbError = sanitizeDbError(err);
      console.error("DB ping failed:", dbError);
    }
    if (!db) {
      throw new ServiceUnavailableException({
        ok: false,
        db: false,
        dbConfigured: Boolean(process.env.DATABASE_URL),
        service: "zat-api",
      });
    }
    return {
      ok: true,
      db: true,
      dbConfigured: true,
      service: "zat-api",
      time: new Date().toISOString(),
    };
  }
}
