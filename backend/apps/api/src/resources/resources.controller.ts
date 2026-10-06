import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthUser } from "../auth/auth.types";
import { ResourcesService } from "./resources.service";
import { RESOURCES } from "./registry";

@Controller("v1")
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(private resources: ResourcesService) {}

  @Get("meta/resources")
  listMeta() {
    return Object.entries(RESOURCES).map(([key, v]) => ({ key, ...v }));
  }

  @Get(":resource")
  list(
    @Param("resource") resource: string,
    @Query() query: Record<string, string>,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.resources.list(resource, req.user, query);
  }

  @Get(":resource/:id")
  get(@Param("resource") resource: string, @Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.resources.get(resource, id, req.user);
  }

  @Post(":resource")
  create(
    @Param("resource") resource: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.resources.create(resource, req.user, body, req.ip);
  }

  @Patch(":resource/:id")
  update(
    @Param("resource") resource: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.resources.update(resource, id, req.user, body, req.ip);
  }

  @Delete(":resource/:id")
  remove(@Param("resource") resource: string, @Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.resources.remove(resource, id, req.user, req.ip);
  }

  @Post(":resource/bulk")
  bulk(
    @Param("resource") resource: string,
    @Body() body: { ids: string[]; action: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.resources.bulk(resource, req.user, body.ids ?? [], body.action);
  }
}
