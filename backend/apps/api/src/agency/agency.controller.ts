import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { AuthUser } from "../auth/auth.types";
import { AgencyService } from "./agency.service";

@Controller("v1/agent")
@UseGuards(JwtAuthGuard)
export class AgencyController {
  constructor(private service: AgencyService) {}
  @Get("me") me(@Req() req: Request & { user: AuthUser }) { return this.service.identity(req.user.id); }
  @Get("catalogue") catalogue(@Req() req: Request & { user: AuthUser }, @Query("page") page?: string) { return this.service.catalogue(req.user.id, page); }
  @Get("requests") requests(@Req() req: Request & { user: AuthUser }, @Query("page") page?: string) { return this.service.requests(req.user.id, page); }
  @Get("requests/:id") request(@Req() req: Request & { user: AuthUser }, @Param("id") id: string) { return this.service.request(req.user.id, id); }
  @Post("requests") submit(@Req() req: Request & { user: AuthUser }, @Body() body: Record<string, unknown>, @Headers("idempotency-key") key?: string) { return this.service.submit(req.user.id, body, key); }
  @Get("quotations") quotations(@Req() req: Request & { user: AuthUser }, @Query("page") page?: string) { return this.service.quotations(req.user.id, page); }
  @Get("bookings") bookings(@Req() req: Request & { user: AuthUser }, @Query() query: { page?: string; q?: string; service?: string; status?: string; from?: string; to?: string }) { return this.service.bookings(req.user.id, query.page, query); }
}
