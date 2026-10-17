import { Controller, Get, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService, sanitizeDbError } from "./common/prisma.service";
import type { Response } from "express";

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get("health")
  async health(@Res({ passthrough: true }) response: Response) {
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
    if (!db) response.status(503);
    return {
      ok: db,
      db,
      dbConfigured: Boolean(process.env.DATABASE_URL),
      service: "zat-api",
      time: new Date().toISOString(),
    };
  }
}
