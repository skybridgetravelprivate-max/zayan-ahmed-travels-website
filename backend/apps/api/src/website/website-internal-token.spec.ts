import { readWebsiteBookingsInternalToken } from "./website-internal-token";

function assert(label: string, ok: boolean) {
  if (!ok) throw new Error(label);
}

const prior = process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = "";
assert("empty when unset", readWebsiteBookingsInternalToken() === "");
process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = "short";
assert("empty when too short", readWebsiteBookingsInternalToken() === "");
process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = "website-customer-bookings-internal-token-32chars";
assert("reads when long enough", readWebsiteBookingsInternalToken().length >= 32);
if (prior === undefined) delete process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN;
else process.env.CUSTOMER_BOOKINGS_INTERNAL_TOKEN = prior;

console.log("website internal token OK");
