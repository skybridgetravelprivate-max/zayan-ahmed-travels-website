import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/** This console is browser-only. Mutations require an approved explicit Origin. */
@Injectable()
export class ManagementOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    context.switchToHttp().getResponse().setHeader("Cache-Control", "private, no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const origins = (process.env.APP_URL ?? "http://localhost:3000").split(",").map(s => s.trim());
    if (typeof req.headers.origin !== "string" || !origins.includes(req.headers.origin)) throw new ForbiddenException("Forbidden origin");
    return true;
  }
}
