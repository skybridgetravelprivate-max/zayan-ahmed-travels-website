import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { ComplaintsService } from "./complaints.service";

@Controller("v1/complaints")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ComplaintsController {
  constructor(private complaints: ComplaintsService) {}

  @Get()
  @RequirePermission("complaint.view")
  list(@Query() query: Record<string, string>, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.list(req.user, query);
  }

  @Get(":id")
  @RequirePermission("complaint.view")
  get(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.get(req.user, id);
  }

  @Post()
  @RequirePermission("complaint.create")
  create(@Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.create(req.user, body, req.ip);
  }

  @Patch(":id")
  @RequirePermission("complaint.edit")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.update(req.user, id, body, req.ip);
  }

  @Post(":id/assign")
  @RequirePermission("complaint.assign")
  assign(
    @Param("id") id: string,
    @Body() body: { assignedUserId: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.complaints.assign(req.user, id, body.assignedUserId, req.ip);
  }

  @Post(":id/resolve")
  @RequirePermission("complaint.resolve")
  resolve(
    @Param("id") id: string,
    @Body() body: { resolution: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.complaints.resolve(req.user, id, body.resolution, req.ip);
  }

  @Post(":id/close")
  @RequirePermission("complaint.close")
  close(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.close(req.user, id, req.ip);
  }

  @Post(":id/notes")
  @RequirePermission("complaint.edit")
  note(@Param("id") id: string, @Body() body: { body: string }, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.addNote(req.user, id, body.body, req.ip);
  }

  @Delete(":id")
  @RequirePermission("complaint.delete")
  remove(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.complaints.remove(req.user, id, req.ip);
  }
}
