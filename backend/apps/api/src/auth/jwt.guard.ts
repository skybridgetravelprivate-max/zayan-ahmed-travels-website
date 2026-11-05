import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../common/prisma.service";
import { agencyForUser } from "../agency/agency-access";
import { AuthUser } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.access_token ?? req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || !process.env.JWT_SECRET) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      if (typeof payload.sub !== "string" || typeof payload.sid !== "string") throw new UnauthorizedException();
      const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException();
      }
      const audience = session.audience || "staff";
      if ((payload.portal || "staff") !== audience) throw new UnauthorizedException();
      const agencyPath = /^\/(?:api\/)?v1\/agent(?:\/|$)/.test(req.path || "");
      if (agencyPath && audience !== "agent") throw new UnauthorizedException();
      if (audience === "agent") {
        if (!agencyPath) throw new UnauthorizedException();
        await agencyForUser(this.prisma, payload.sub);
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          branches: true,
        },
      });
      if (!user || user.deletedAt || user.status !== "ACTIVE") throw new UnauthorizedException();
      if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException("Account locked");
      const roleNames = user.roles.map((r) => r.role.name);
      const permissions = [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)))];
      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        permissions,
        roleNames,
        branchIds: user.branches.map((b) => b.branchId),
        defaultBranchId: user.defaultBranchId,
        isSuperAdmin: roleNames.includes("SUPER_ADMIN") || roleNames.includes("Super Admin"),
      };
      req.user = authUser;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
