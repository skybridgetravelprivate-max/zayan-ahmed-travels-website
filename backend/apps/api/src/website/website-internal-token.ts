import { UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";

const HEADER = "x-zat-internal-token";

export function readWebsiteBookingsInternalToken(): string {
  const token = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN?.trim() ?? "";
  if (token.length < 32) return "";
  return token;
}

export function assertWebsiteInternalToken(headerValue: string | undefined) {
  const expected = readWebsiteBookingsInternalToken();
  if (!expected) {
    throw new ServiceUnavailableException();
  }
  const provided = (headerValue ?? "").trim();
  if (!provided || provided !== expected) {
    throw new UnauthorizedException();
  }
}

export function websiteInternalTokenHeaderName() {
  return HEADER;
}
