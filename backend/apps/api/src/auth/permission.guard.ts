import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthUser, can } from "./auth.types";

export const PERMISSION_KEY = "permission";
export const RequirePermission = (code: string) => SetMetadata(PERMISSION_KEY, code);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const code = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!code) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!user || !can(user, code)) throw new ForbiddenException();
    return true;
  }
}
