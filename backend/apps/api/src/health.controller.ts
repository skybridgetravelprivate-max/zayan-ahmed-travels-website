import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService, sanitizeDbError } from "./common/prisma.service";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

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
    return {
      ok: true,
      db,
      dbConfigured: Boolean(process.env.DATABASE_URL),
      service: "zat-api",
      time: new Date().toISOString(),
    };
  }
}
