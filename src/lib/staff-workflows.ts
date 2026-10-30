import type { ManagementField } from "./staff-management";

export type StaffWorkflow = { key: string; label: string; permission: string; path: string; fields: ManagementField[]; record: boolean; superOnly?: boolean; version?: boolean; caution?: string };
const text = (name: string, label: string, required = true): ManagementField => ({ name, label, required, nullable: !required, type: "String" });
const money = (name: string, label: string, required = true): ManagementField => ({ ...text(name, label, required), type: "Decimal" });
const ref = (name: string, label: string, reference: string, required = false): ManagementField => ({ ...text(name, label, required), reference });
const choice = (name: string, label: string, options: string[]): ManagementField => ({ ...text(name, label), type: "select", options });
const workflow = (key: string, label: string, permission: string, path: string, fields: ManagementField[], record = true, extra: Partial<StaffWorkflow> = {}): StaffWorkflow => ({ key, label, permission, path, fields, record, ...extra });
const methods = ["CASH", "BANK", "CARD", "ONLINE"];

// Fixed business endpoints only. No arbitrary endpoint, method or body editor.
export const STAFF_WORKFLOWS: Record<string, StaffWorkflow[]> = {
  leads: [
    workflow("status", "Change lead status", "lead.edit", "/api/v1/management/leads/:id/status", [choice("status", "Status", ["NEW", "CONTACTED", "FOLLOW_UP", "INTERESTED", "QUOTED", "NEGOTIATION", "CONFIRMED", "LOST", "CANCELLED"]), text("lostReason", "Reason (required for lost/cancelled)", false)], true, { version: true }),
    workflow("note", "Add lead note", "lead.edit", "/api/v1/crm/leads/:id/notes", [text("body", "Note")]),
    workflow("quote", "Create quotation", "quotation.create", "/api/v1/crm/leads/:id/quotation", [], true, { caution: "Creates a new quotation linked to this lead." }),
    workflow("convert", "Convert to customer", "lead.edit", "/api/v1/crm/leads/:id/convert", [], true, { caution: "Creates or links a CRM customer and updates this lead." }),
  ],
  customers: [workflow("quote", "Create customer quotation", "quotation.create", "/api/v1/crm/customers/:id/quotation", [])],
  quotations: [
    workflow("create", "New quotation", "quotation.create", "/api/v1/crm/quotations", [ref("customerId", "Customer", "customers"), ref("leadId", "Lead", "leads")], false),
    workflow("item", "Add quotation item", "quotation.edit", "/api/v1/crm/quotations/:id/items", [text("description", "Description"), { ...money("quantity", "Quantity"), type: "Int", min: 1 }, money("sellingPrice", "Selling price"), money("cost", "Cost")]),
    workflow("send", "Mark quotation sent", "quotation.edit", "/api/v1/crm/quotations/:id/send", [], true, { caution: "Updates quotation status. This does not imply an email was delivered." }),
  ],
  complaints: [
    workflow("resolve", "Resolve complaint", "complaint.resolve", "/api/v1/complaints/:id/resolve", [text("resolution", "Resolution")]),
    workflow("close", "Close complaint", "complaint.close", "/api/v1/complaints/:id/close", []),
    workflow("note", "Add complaint note", "complaint.edit", "/api/v1/complaints/:id/notes", [text("body", "Note")]),
  ],
  "umrah-bookings": [
    workflow("create", "New Umrah booking", "umrah.create", "/api/v1/umrah", [ref("branchId", "Branch (uses your default if blank)", "branches"), ref("customerId", "Customer", "customers", true), ref("packageId", "Package", "umrah-packages"), ref("groupId", "Group", "umrah-groups"), { ...text("departureDate", "Departure", false), type: "DateTime" }, { ...text("returnDate", "Return", false), type: "DateTime" }, money("sellingPrice", "Selling price"), money("cost", "Cost"), money("discount", "Discount", false), money("tax", "Tax", false), money("paid", "Paid", false), { ...choice("paymentMethod", "Initial receipt method", ["CASH", "BANK"]), required: false, nullable: true }, text("notes", "Notes", false)], false, { caution: "Creates an Umrah booking and its accounting entries." }),
    workflow("lifecycle", "Update booking stage", "umrah.edit", "/api/v1/umrah/:id/lifecycle", [choice("step", "Stage", ["Draft", "Inquiry", "Quotation", "Confirmation", "Payment", "Booking Confirmed", "Visa Processing", "Visa Approved", "Ticket Confirmed", "Hotel Confirmed", "Transport Confirmed", "Voucher Generated", "Travel", "Completed", "Cancelled"])])],
  "hotel-bookings": [
    workflow("create-reservation", "New hotel reservation", "hotel.booking", "/api/v1/hotel-reservations", [ref("branchId", "Branch (uses your default if blank)", "branches"), ref("customerId", "Customer", "customers", true), ref("passengerId", "Guest (single-room reservations)", "passengers"), ref("hotelId", "Hotel", "hotels", true), ref("roomTypeId", "Room type", "hotel-rooms", true), { ...text("checkIn", "Check-in (UTC)"), type: "DateTime" }, { ...text("checkOut", "Check-out (UTC)"), type: "DateTime" }, { ...money("roomCount", "Number of rooms"), type: "Int" }, { ...money("occupancy", "Occupancy per room"), type: "Int" }, money("sellingPrice", "Selling price per room"), money("supplierCost", "Cost per room"), money("paid", "Initial paid amount", false), { ...choice("paymentMethod", "Initial receipt method", ["CASH", "BANK"]), required: false, nullable: true }, text("notes", "Notes", false)], false, { caution: "Creates a single-stay reservation and its accounting entries. Prices are totals per room for the entire stay." }),
    workflow("allocate", "Assign room guest", "hotel.booking", "/api/v1/hotel-reservations/:id/allocate", [choice("roomId", "Stay room", []), ref("passengerId", "Guest", "passengers", true)]),
    workflow("transfer", "Transfer room guests", "reservation.transfer", "/api/v1/hotel-reservations/:id/transfer", [choice("fromRoomId", "Source stay room", []), text("roomNumber", "New room number")], true, { caution: "Moves all guests to a new room in the same stay. Booking charges remain unchanged." }),
    workflow("checkin", "Check in room", "reservation.checkin", "/api/v1/hotel-reservations/:id/checkin", [choice("roomId", "Stay room", []), text("roomNumber", "Room number", false)]),
    workflow("checkout", "Check out room", "reservation.checkout", "/api/v1/hotel-reservations/:id/checkout", [choice("roomId", "Stay room", [])]),
    workflow("cancel", "Cancel reservation", "reservation.cancel", "/api/v1/hotel-reservations/:id/cancel", [text("reason", "Cancellation reason")], true, { caution: "Cancels the reservation and performs its accounting workflow. Review the selected reservation carefully." })],
  tickets: [
    workflow("create", "Issue ticket", "ticket.create", "/api/v1/workflows/tickets", [ref("branchId", "Branch (uses your default if blank)", "branches"), text("ticketNumber", "Ticket number"), ref("customerId", "Customer", "customers", true), ref("passengerId", "Passenger", "passengers"), ref("airlineId", "Airline", "airlines"), ref("supplierId", "Supplier", "suppliers"), text("flightNumber", "Flight number", false), text("sector", "Sector"), { ...text("departureAt", "Departure", false), type: "DateTime" }, money("fare", "Fare"), money("tax", "Tax", false), money("discount", "Discount", false), money("cost", "Cost"), money("paidAmount", "Paid amount", false), { ...choice("paymentMethod", "Initial receipt method", ["CASH", "BANK"]), required: false, nullable: true }], false, { caution: "Issues a ticket and posts its sale/cost journals." }),
    workflow("refund", "Refund ticket", "ticket.refund", "/api/v1/workflows/tickets/:id/refund", [money("refundAmount", "Refund amount"), money("airlineDeduction", "Airline deduction", false), money("agencyDeduction", "Agency deduction", false), money("otherCharges", "Other charges", false), text("reason", "Refund reason")], true, { caution: "Posts a financial refund. Review the amount, deductions, and selected ticket. Do not repeat after an uncertain outcome." })],
  "transport-bookings": [workflow("create", "New transport booking", "transport.create", "/api/v1/workflows/transport", [ref("branchId", "Branch (uses your default if blank)", "branches"), ref("customerId", "Customer", "customers", true), ref("vehicleId", "Vehicle", "vehicles"), ref("driverId", "Driver", "drivers"), text("pickup", "Pickup"), text("dropoff", "Drop-off"), { ...text("tripDate", "Trip date"), type: "DateTime" }, { ...money("paxCount", "Passenger count"), type: "Int" }, money("sellingPrice", "Selling price"), money("cost", "Cost"), money("paid", "Paid", false), { ...choice("paymentMethod", "Initial receipt method", ["CASH", "BANK"]), required: false, nullable: true }], false, { caution: "Creates a transport booking, voucher and accounting entries." })],
  journals: [
    workflow("post", "Post journal", "account.post", "/api/v1/finance/journals/:id/post", [], true, { superOnly: true, caution: "Posts this journal to the ledger." }),
    workflow("reverse", "Reverse journal", "account.reverse", "/api/v1/finance/journals/:id/reverse", [], true, { superOnly: true, caution: "Creates a reversing ledger entry. Review the selected journal." }),
  ],
  receipts: [workflow("create", "Record receipt", "account.post", "/api/v1/finance/receipts", [ref("customerId", "Customer", "customers"), ref("bookingId", "Umrah booking", "umrah-bookings"), ref("ticketSaleId", "Ticket", "tickets"), ref("hotelBookingId", "Hotel reservation", "hotel-bookings"), ref("transportBookingId", "Transport booking", "transport-bookings"), ref("starBookingId", "STAR booking", "star-bookings"), money("amount", "Amount"), choice("method", "Payment method", methods), text("notes", "Notes", false)], false, { superOnly: true, caution: "Posts a receipt and may update the booking balance. Check the selected customer and booking." })],
  payments: [workflow("create", "Record supplier payment", "account.post", "/api/v1/finance/payments", [ref("supplierId", "Supplier", "suppliers", true), money("amount", "Amount"), choice("method", "Payment method", methods), text("notes", "Notes", false)], false, { superOnly: true, caution: "Posts a supplier payment to the ledger." })],
  expenses: [workflow("create", "Record expense", "account.post", "/api/v1/finance/expenses", [text("category", "Category"), money("amount", "Amount"), ref("supplierId", "Supplier", "suppliers"), text("notes", "Notes", false)], false, { superOnly: true, caution: "Posts an expense to the ledger." })],
};
export function workflowsFor(resource: string, record: boolean, permissions: string[], superAdmin: boolean) {
  return (STAFF_WORKFLOWS[resource] ?? []).filter(w => w.record === record && (!w.superOnly || superAdmin) && (superAdmin || permissions.includes(w.permission)));
}
