import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthUser } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ManagementService } from "./management.service";
import { ManagementOriginGuard } from "./management.guard";

@Controller("v1/management")
@UseGuards(JwtAuthGuard, ManagementOriginGuard)
export class ManagementController {
  constructor(private management: ManagementService) {}
  @Get("modules")
  modules(@Req() req: Request & { user: AuthUser }, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "private, no-store");
    return this.management.catalog(req.user);
  }
  @Get("umrah/catalog")
  umrahCatalog(@Req() req: Request & { user: AuthUser }) { return this.management.umrahCatalog(req.user); }
  @Get("options/:resource")
  options(@Param("resource") resource: string, @Query("q") q: string | undefined, @Req() req: Request & { user: AuthUser }) { return this.management.options(req.user, resource, q); }
  @Get("leads/:id/assignees")
  assignees(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) { return this.management.assignees(req.user, id); }
  @Get("hotel-bookings/:id/rooms")
  rooms(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) { return this.management.stayRooms(req.user, id); }
  @Get("users/:id/access")
  access(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) { return this.management.staffAccess(req.user, id); }
  @Post("users/:id/access")
  saveAccess(@Param("id") id: string, @Body() body: { roleIds?: unknown; branchIds?: unknown; defaultBranchId?: unknown; status?: unknown; version?: unknown }, @Req() req: Request & { user: AuthUser }) { return this.management.saveStaffAccess(req.user, id, body); }
  @Post("users/create-account")
  createStaff(@Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }) { return this.management.createStaff(req.user, body); }
  @Post("leads/:id/assign")
  assign(@Param("id") id: string, @Body() body: { assignedUserId?: unknown; version?: unknown }, @Req() req: Request & { user: AuthUser }) { return this.management.assign(req.user, id, body); }
  @Post("leads/:id/status")
  status(@Param("id") id: string, @Body() body: { status?: unknown; lostReason?: unknown; version?: unknown }, @Req() req: Request & { user: AuthUser }) { return this.management.leadStatus(req.user, id, body); }
  @Get(":resource")
  list(@Param("resource") resource: string, @Query() query: Record<string, string>, @Req() req: Request & { user: AuthUser }, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "private, no-store");
    return this.management.list(req.user, resource, query);
  }
  @Get(":resource/:id/summary")
  summary(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.management.summary(req.user, resource, id);
  }
  @Get(":resource/:id")
  detail(@Param("resource") resource: string, @Param("id") id: string, @Req() req: Request & { user: AuthUser }, @Res({ passthrough: true }) res: Response) {
    res.setHeader("Cache-Control", "private, no-store");
    return this.management.detail(req.user, resource, id);
  }
  @Post(":resource")
  create(@Param("resource") resource: string, @Body() body: unknown, @Req() req: Request & { user: AuthUser }) { return this.management.save(req.user, resource, null, body, req.ip); }
  @Patch(":resource/:id")
  edit(@Param("resource") resource: string, @Param("id") id: string, @Body() body: unknown, @Req() req: Request & { user: AuthUser }) { return this.management.save(req.user, resource, id, body, req.ip); }
}
