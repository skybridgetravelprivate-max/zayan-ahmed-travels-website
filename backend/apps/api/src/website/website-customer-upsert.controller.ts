import { Body, Controller, Headers, Post, ServiceUnavailableException } from "@nestjs/common";
import {
  assertWebsiteInternalToken,
  readWebsiteBookingsInternalToken,
  websiteInternalTokenHeaderName,
} from "./website-internal-token";
import { WebsiteCustomerUpsertService } from "./website-customer-upsert.service";

/** Website S2S — path is /v1/customer/upsert-by-email (no /api prefix). */
@Controller("v1/customer")
export class WebsiteCustomerUpsertController {
  constructor(private upsert: WebsiteCustomerUpsertService) {}

  @Post("upsert-by-email")
  create(
    @Body() body: { email?: string; fullName?: string },
    @Headers(websiteInternalTokenHeaderName()) internalToken: string | undefined,
  ) {
    if (!readWebsiteBookingsInternalToken()) {
      throw new ServiceUnavailableException();
    }
    assertWebsiteInternalToken(internalToken);
    return this.upsert.upsertByEmail(body ?? {});
  }
}
