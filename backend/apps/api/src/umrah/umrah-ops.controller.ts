import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { UmrahOpsService } from "./umrah-ops.service";

@Controller("v1/umrah")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UmrahOpsController {
  constructor(private umrah: UmrahOpsService) {}

  @Get("dashboards")
  @RequirePermission("umrah.view")
  dashboards(@Req() req: Request & { user: AuthUser }) {
    return this.umrah.dashboards(req.user);
  }

  @Post()
  @RequirePermission("umrah.create")
  save(@Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }, @Headers("idempotency-key") requestKey?: string) {
    return this.umrah.save(req.user, body, req.ip, requestKey);
  }

  @Post(":id/lifecycle")
  @RequirePermission("umrah.edit")
  lifecycle(@Param("id") id: string, @Body() body: { step: string }, @Req() req: Request & { user: AuthUser }) {
    return this.umrah.lifecycle(req.user, id, body.step, req.ip);
  }

  @Post(":id/iata")
  @RequirePermission("umrah.edit")
  iata(@Param("id") id: string, @Body() body: { iataCode: string }, @Req() req: Request & { user: AuthUser }) {
    return this.umrah.lockIata(req.user, id, body.iataCode, req.ip);
  }
}
