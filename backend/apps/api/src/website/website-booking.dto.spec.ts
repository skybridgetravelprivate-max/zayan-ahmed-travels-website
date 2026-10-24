import {
  mapWebsiteStatus,
  travelDateFrom,
  type WebsiteCustomerBookingDto,
  isWebsiteBookingRow,
} from "./website-booking.dto";

function assert(label: string, ok: boolean) {
  if (!ok) throw new Error(label);
}

assert("cancelled flag", mapWebsiteStatus("DRAFT", true) === "Cancelled");
assert("cancel in text", mapWebsiteStatus("CANCELLED", false) === "Cancelled");
assert("completed umrah", mapWebsiteStatus("COMPLETED", false) === "Completed");
assert("approved visa", mapWebsiteStatus("APPROVED", false) === "Completed");
assert("draft upcoming", mapWebsiteStatus("DRAFT", false) === "Upcoming");
assert("travel date", travelDateFrom(new Date("2026-11-12T15:00:00.000Z")) === "2026-11-12");

const sample: WebsiteCustomerBookingDto = {
  reference: "UMR-2026-000001",
  service: "Umrah",
  destination: "Makkah",
  travelDate: "2026-11-12",
  status: "Upcoming",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
assert("valid row", isWebsiteBookingRow(sample));
assert("undated row stays visible", isWebsiteBookingRow({ ...sample, travelDate: null }));
assert("missing travel date is explicit null", travelDateFrom(null) === null);
assert("invalid service", !isWebsiteBookingRow({ ...sample, service: "Ticket" as WebsiteCustomerBookingDto["service"] }));

console.log("website booking dto OK");
