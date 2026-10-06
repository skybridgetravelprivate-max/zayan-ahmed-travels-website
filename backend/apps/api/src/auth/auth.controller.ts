import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "../common/password";
import { MailService } from "../common/mail.service";
import { JwtAuthGuard } from "./jwt.guard";
import { UseGuards } from "@nestjs/common";
import { AuthUser } from "./auth.types";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

@Controller("auth")
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  private cookieOpts(maxAge: number) {
    const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none" | undefined) ?? "lax";
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true" || sameSite === "none",
      sameSite,
      path: "/",
      maxAge,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
    };
  }

  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post("login")
  async login(
    @Body() body: { identifier?: string; password?: string; rememberMe?: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const identifier = (body.identifier ?? "").trim();
    const password = body.password ?? "";
    if (!identifier || !password) throw new BadRequestException("Email/username and password are required");

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });
    const ip = req.ip;

    if (!user) {
      await this.prisma.loginAttempt.create({ data: { identifier, success: false, ipAddress: ip } });
      throw new UnauthorizedException("Invalid credentials");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException("Account locked. Try later.");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    await this.prisma.loginAttempt.create({
      data: { userId: user.id, identifier, success: ok, ipAddress: ip },
    });
    if (!ok) {
      const failed = user.failedLogins + 1;
      const lockedUntil = failed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil, status: lockedUntil ? "LOCKED" : user.status },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.status !== "ACTIVE" && user.status !== "LOCKED") {
      throw new UnauthorizedException("Account inactive");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, status: "ACTIVE" },
    });

    const refreshRaw = randomBytes(48).toString("hex");
    const refreshHash = createHash("sha256").update(refreshRaw).digest("hex");
    const days = body.rememberMe ? 30 : 7;
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refreshHash,
        userAgent: req.headers["user-agent"],
        ipAddress: ip,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    const access = await this.jwt.signAsync(
      { sub: user.id, sid: session.id },
      { secret: process.env.JWT_SECRET, expiresIn: 15 * 60 },
    );
    res.cookie(ACCESS_COOKIE, access, this.cookieOpts(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, `${session.id}.${refreshRaw}`, this.cookieOpts(days * 24 * 60 * 60 * 1000));
    return { ok: true, user: { id: user.id, email: user.email, fullName: user.fullName } };
  }

  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedException();
    const [sessionId, token] = raw.split(".");
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException();
    const hash = createHash("sha256").update(token ?? "").digest("hex");
    if (hash !== session.refreshTokenHash) throw new UnauthorizedException();
    const access = await this.jwt.signAsync(
      { sub: session.userId, sid: session.id },
      { secret: process.env.JWT_SECRET, expiresIn: 15 * 60 },
    );
    res.cookie(ACCESS_COOKIE, access, this.cookieOpts(15 * 60 * 1000));
    return { ok: true };
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) {
      const sessionId = raw.split(".")[0];
      await this.prisma.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(ACCESS_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout-all")
  async logoutAll(@Req() req: Request & { user: AuthUser }, @Res({ passthrough: true }) res: Response) {
    await this.prisma.session.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.clearCookie(ACCESS_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_COOKIE, { path: "/" });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: Request & { user: AuthUser }) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  sessions(@Req() req: Request & { user: AuthUser }) {
    return this.prisma.session.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true, revokedAt: true },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  async changePassword(
    @Req() req: Request & { user: AuthUser },
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !body.currentPassword || !body.newPassword) throw new BadRequestException();
    assertPasswordPolicy(body.newPassword);
    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Current password is incorrect");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });
    return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  async forgot(@Body() body: { email?: string }) {
    const email = body.email?.trim();
    if (!email) throw new BadRequestException();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      await this.prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = `${process.env.APP_URL}/reset-password?token=${token}`;
      await this.mail.send(email, "Reset your password", `<p>Reset link: <a href="${link}">${link}</a></p>`);
    }
    return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  async reset(@Body() body: { token?: string; password?: string }) {
    if (!body.token || !body.password) throw new BadRequestException();
    assertPasswordPolicy(body.password);
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row) throw new BadRequestException("Invalid or expired token");
    await this.prisma.user.update({
      where: { email: row.email },
      data: { passwordHash: await hashPassword(body.password), failedLogins: 0, lockedUntil: null, status: "ACTIVE" },
    });
    await this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("login-history")
  loginHistory(@Req() req: Request & { user: AuthUser }) {
    return this.prisma.loginAttempt.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
