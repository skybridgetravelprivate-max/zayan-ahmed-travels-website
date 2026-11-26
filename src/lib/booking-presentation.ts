/** Presentation only: never changes payload fields, permissions or pricing. */
export function bookingFieldSection(name: string, resource?: string) {
  if (resource === "tickets") {
    if (name === "cost") return "Buying details";
    if (/^(fare|tax|discount|net)$/.test(name)) return "Selling details";
    if (/^(paidAmount|paymentMethod)$/.test(name)) return "Receivings";
  }
  if (/customer|passenger|leadId|assigned/i.test(name)) return "Customer & travellers";
  if (/^net$|price|cost|fare|tax|discount|paid|balance|amount|deduction|charges|currency/i.test(name)) return "Pricing & payment";
  if (/date|departure|arrival|return|cabin|baggage|checkIn|checkOut|hotel|room|occupancy|pickup|dropoff|sector|flight|airline|vehicle|driver|pax|seats/i.test(name)) return "Journey & service";
  if (/notes|description|reason|terms/i.test(name)) return "Notes & instructions";
  return "Reference & administration";
}

const documentRoutes: Record<string, string> = {
  quotations: "quotation", "umrah-bookings": "umrah-booking", "hotel-bookings": "hotel-reservation",
  tickets: "ticket-invoice", "ticket-refunds": "ticket-refund", "service-invoices": "service-invoice", receipts: "receipt",
  "transport-bookings": "transport-booking", "transport-vouchers": "transport-voucher", "visa-applications": "visa-application",
};
export function bookingDocumentUrl(resource: string, id: string, priceIncluded: boolean) {
  const route = Object.hasOwn(documentRoutes, resource) ? documentRoutes[resource] : null;
  return route ? `/api/v1/pdf/${route}/${encodeURIComponent(id)}?mode=${priceIncluded ? "INCLUDED" : "EXCLUDED"}` : null;
}
