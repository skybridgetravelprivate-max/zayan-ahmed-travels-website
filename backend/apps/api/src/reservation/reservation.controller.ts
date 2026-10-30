import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { PermissionGuard, RequirePermission } from "../auth/permission.guard";
import { AuthUser } from "../auth/auth.types";
import { ReservationService, ReservationInput } from "./reservation.service";

@Controller("v1/hotel-reservations")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReservationController {
  constructor(private reservations: ReservationService) {}

  @Get("dashboards")
  @RequirePermission("hotel.booking")
  dashboards(@Req() req: Request & { user: AuthUser }) {
    return this.reservations.dashboards(req.user);
  }

  @Get()
  @RequirePermission("hotel.booking")
  list(
    @Req() req: Request & { user: AuthUser },
    @Query() q: { kind?: string; status?: string; hotelId?: string; pending?: string; tentative?: string },
  ) {
    return this.reservations.list(req.user, q);
  }

  @Get(":id")
  @RequirePermission("hotel.booking")
  get(@Param("id") id: string, @Req() req: Request & { user: AuthUser }) {
    return this.reservations.get(req.user, id);
  }

  @Post()
  @RequirePermission("hotel.booking")
  save(@Body() body: ReservationInput, @Req() req: Request & { user: AuthUser }, @Headers("idempotency-key") requestKey?: string) {
    return this.reservations.save(req.user, body, req.ip, undefined, requestKey);
  }

  @Post(":id/allocate")
  @RequirePermission("hotel.booking")
  allocate(@Param("id") id: string, @Body() body: { roomId: string; passengerId: string }, @Req() req: Request & { user: AuthUser }) {
    return this.reservations.allocate(req.user, id, body.roomId, body.passengerId, req.ip);
  }

  @Post(":id/checkin")
  @RequirePermission("reservation.checkin")
  checkin(
    @Param("id") id: string,
    @Body() body: { roomId: string; at?: string; roomNumber?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.reservations.checkin(req.user, body.roomId || id, body.at, body.roomNumber, req.ip, id);
  }

  @Post(":id/checkout")
  @RequirePermission("reservation.checkout")
  checkout(
    @Param("id") id: string,
    @Body() body: { roomId: string; at?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.reservations.checkout(req.user, body.roomId || id, body.at, req.ip, id);
  }

  @Post(":id/transfer")
  @RequirePermission("reservation.transfer")
  transfer(
    @Param("id") id: string,
    @Body() body: { fromRoomId: string; toRoomId?: string; roomNumber?: string },
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.reservations.transfer(req.user, body.fromRoomId, body.toRoomId, body.roomNumber, req.ip, id);
  }

  @Post(":id/split")
  @RequirePermission("reservation.split")
  split(@Param("id") id: string, @Body() body: { roomIds: string[] }, @Req() req: Request & { user: AuthUser }) {
    return this.reservations.split(req.user, id, body.roomIds || [], req.ip);
  }

  @Post(":id/cancel")
  @RequirePermission("reservation.cancel")
  cancel(@Param("id") id: string, @Body() body: { reason: string }, @Req() req: Request & { user: AuthUser }) {
    return this.reservations.cancel(req.user, id, body.reason, req.ip);
  }
}
