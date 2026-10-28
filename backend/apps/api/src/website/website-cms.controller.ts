import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { ManagementOriginGuard } from "../management/management.guard";
import { AuthUser } from "../auth/auth.types";
import { WebsiteCmsService } from "./website-cms.service";

@Controller("v1/website/pages")
@UseGuards(JwtAuthGuard, ManagementOriginGuard)
export class WebsiteCmsController {
  constructor(private cms: WebsiteCmsService) {}
  @Get(":slug/revisions") revisions(
    @Param("slug") slug: string,
    @Query("before") before: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.cms.revisions(req.user, slug, Number(before));
  }
  @Get() list(@Req() req: Request & { user: AuthUser }) {
    return this.cms.list(req.user);
  }
  @Get(":slug") read(
    @Param("slug") slug: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.cms.read(req.user, slug);
  }
  @Put(":slug") save(
    @Param("slug") slug: string,
    @Body() body: { version?: unknown; content?: unknown },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.cms.save(req.user, slug, body);
  }
  @Post(":slug/:action") transition(
    @Param("slug") slug: string,
    @Param("action") action: string,
    @Body() body: { version?: unknown; revision?: unknown },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.cms.transition(req.user, slug, action, body);
  }
}
