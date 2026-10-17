import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

/** Global ledger/report operations have no complete branch projection yet. */
@Injectable()
export class GlobalFinanceGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (!context.switchToHttp().getRequest().user?.isSuperAdmin) {
      throw new ForbiddenException("Global finance and reports require super-admin access");
    }
    return true;
  }
}
