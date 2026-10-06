import { Controller, Get, Headers, Query, ServiceUnavailableException } from "@nestjs/common";
import { WebsiteCustomerBookingsService } from "./website-customer-bookings.service";
import { assertWebsiteInternalToken, readWebsiteBookingsInternalToken, websiteInternalTokenHeaderName } from "./website-internal-token";

/** Website S2S — path is /v1/customer/bookings (no /api prefix). See create-app global prefix exclude. */
@Controller("v1/customer")
export class WebsiteCustomerBookingsController {
  constructor(private bookings: WebsiteCustomerBookingsService) {}

  @Get("bookings")
  list(
    @Query("website_customer_id") websiteCustomerId: string | undefined,
    @Headers(websiteInternalTokenHeaderName()) internalToken: string | undefined,
  ) {
    if (!readWebsiteBookingsInternalToken()) {
      throw new ServiceUnavailableException();
    }
    assertWebsiteInternalToken(internalToken);
    return this.bookings.listForWebsiteCustomer(websiteCustomerId ?? "");
  }
}
