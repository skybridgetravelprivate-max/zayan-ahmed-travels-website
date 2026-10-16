import { CanActivate, Injectable, ServiceUnavailableException } from "@nestjs/common";

export function websiteCustomerWritesEnabled() {
  const configured = process.env.CUSTOMER_WRITES_ENABLED;
  if (configured === undefined) return process.env.NODE_ENV !== "production";
  return configured.trim().toLowerCase() === "true";
}

@Injectable()
export class WebsiteCustomerWriteGuard implements CanActivate {
  canActivate() {
    if (!websiteCustomerWritesEnabled()) {
      throw new ServiceUnavailableException("Customer account writes are temporarily unavailable.");
    }
    return true;
  }
}
