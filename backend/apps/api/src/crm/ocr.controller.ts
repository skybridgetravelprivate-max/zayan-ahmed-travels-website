import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { PeopleOcrService } from "./people-ocr.service";

@Controller("v1/ocr")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OcrController {
  constructor(private ocr: PeopleOcrService) {}

  @Post("passport/parse")
  @RequirePermission("passenger.create")
  parse(@Body() body: { rawText?: string }, @Req() req: Request & { user: AuthUser }) {
    return this.ocr.storeDraft(req.user, {
      rawText: body.rawText || "",
      entityType: "passenger",
    });
  }

  @Post("passport/confirm")
  confirm(
    @Body()
    body: {
      extractId: string;
      customerId?: string;
      passengerId?: string;
      overwriteFields?: string[];
      userEdits?: Record<string, string>;
    },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.ocr.confirm(req.user, body);
  }
}
