export type ResourceMeta = {
  model: string;
  permission: string;
  search?: string[];
  number?: { field: string; key: string; prefix: string };
  omitOnWrite?: string[];
  branchField?: string;
  defaultSort?: string;
};

export const RESOURCES: Record<string, ResourceMeta> = {
  leads: { model: "lead", permission: "lead", search: ["fullName", "mobile", "email", "cnic", "leadNumber"], number: { field: "leadNumber", key: "lead", prefix: "ZAT-LD" }, branchField: "branchId" },
  customers: { model: "customer", permission: "customer", search: ["fullName", "phone", "email", "cnic", "customerNumber"], number: { field: "customerNumber", key: "customer", prefix: "ZAT-CUS" }, branchField: "branchId" },
  passengers: { model: "passenger", permission: "passenger", search: ["fullName", "passportNumber", "cnic", "mobile"] },
  "follow-ups": { model: "followUp", permission: "followup", search: ["subject"] },
  tasks: { model: "task", permission: "task", search: ["title"] },
  quotations: { model: "quotation", permission: "quotation", search: ["quotationNumber"], number: { field: "quotationNumber", key: "quotation", prefix: "ZAT-QT" }, branchField: "branchId" },
  "umrah-packages": { model: "umrahPackage", permission: "umrah", search: ["name", "packageNumber"], number: { field: "packageNumber", key: "umrah-pkg", prefix: "ZAT-PKG" } },
  "umrah-bookings": { model: "umrahBooking", permission: "booking", search: ["bookingNumber"], number: { field: "bookingNumber", key: "umrah-bk", prefix: "ZAT-UM" }, branchField: "branchId" },
  "umrah-groups": { model: "umrahGroup", permission: "umrah", search: ["name", "groupNumber"], number: { field: "groupNumber", key: "umrah-grp", prefix: "ZAT-UG" }, branchField: "branchId" },
  "umrah-visas": { model: "umrahVisa", permission: "visa", search: ["visaNumber", "applicationNumber", "passportNumber"] },
  ziyarat: { model: "ziyarat", permission: "umrah", search: ["name", "city"], defaultSort: "name" },
  intimations: { model: "intimation", permission: "umrah", search: ["type", "location"] },
  hotels: { model: "hotel", permission: "hotel", search: ["name", "city", "hotelNumber"], number: { field: "hotelNumber", key: "hotel", prefix: "ZAT-HT" } },
  "hotel-rooms": { model: "hotelRoomType", permission: "hotel", defaultSort: "name" },
  "hotel-inventory": { model: "hotelInventoryDay", permission: "hotel" },
  "hotel-bookings": { model: "hotelBooking", permission: "hotel", search: ["bookingNumber"], number: { field: "bookingNumber", key: "htl-bk", prefix: "ZAT-HB" }, branchField: "branchId" },
  "star-bookings": { model: "starBooking", permission: "star", search: ["bookingNumber", "groupName", "groupCode", "confirmationNo"], number: { field: "bookingNumber", key: "str", prefix: "STR" }, branchField: "branchId" },
  complaints: { model: "complaint", permission: "complaint", search: ["complaintNumber", "subject", "description", "bookingRef"], number: { field: "complaintNumber", key: "cmp", prefix: "CMP" }, branchField: "branchId" },
  "hotel-vouchers": { model: "hotelVoucher", permission: "hotel", search: ["voucherNo"], number: { field: "voucherNo", key: "htl-v", prefix: "ZAT-HV" } },
  suppliers: { model: "supplier", permission: "supplier", search: ["name", "company", "email"] },
  airlines: { model: "airline", permission: "ticket", search: ["name", "code"], defaultSort: "name" },
  airports: { model: "airport", permission: "ticket", search: ["iata", "icao", "name"], defaultSort: "iata" },
  countries: { model: "country", permission: "settings", search: ["iso2", "name"], defaultSort: "name" },
  cities: { model: "city", permission: "settings", search: ["name"], defaultSort: "name" },
  "visa-types": { model: "visaType", permission: "visa", search: ["code", "name"], defaultSort: "name" },
  services: { model: "service", permission: "account", search: ["code", "name"], defaultSort: "code" },
  "payment-methods": { model: "paymentMethod", permission: "account", search: ["code", "name"], defaultSort: "name" },
  "room-types": { model: "roomType", permission: "hotel", search: ["code", "name"], defaultSort: "code" },
  "hotel-physical-rooms": { model: "hotelRoom", permission: "hotel", search: ["roomNumber"], defaultSort: "roomNumber" },
  "system-settings": { model: "systemSetting", permission: "settings", search: ["key"] },
  tickets: { model: "ticketSale", permission: "ticket", search: ["ticketNumber", "flightNumber", "sector"], branchField: "branchId" },
  "ticket-refunds": { model: "ticketRefund", permission: "ticket", defaultSort: "refundedAt" },
  "ticket-reissues": { model: "ticketReissue", permission: "ticket", defaultSort: "reissuedAt" },
  "ticket-groups": { model: "ticketGroup", permission: "ticket", search: ["groupNumber", "sector"], number: { field: "groupNumber", key: "tkt-grp", prefix: "ZAT-TG" }, defaultSort: "groupNumber" },
  pnr: { model: "pnrRecord", permission: "ticket", search: ["pnr"] },
  vehicles: { model: "vehicle", permission: "transport", search: ["plateNumber", "type"], defaultSort: "plateNumber" },
  drivers: { model: "driver", permission: "transport", search: ["fullName", "phone", "licenseNo"], defaultSort: "fullName" },
  "transport-bookings": { model: "transportBooking", permission: "transport", search: ["bookingNumber"], number: { field: "bookingNumber", key: "tr-bk", prefix: "ZAT-TR" }, branchField: "branchId" },
  "transport-vouchers": { model: "transportVoucher", permission: "transport", search: ["voucherNo"], number: { field: "voucherNo", key: "tr-v", prefix: "ZAT-TV" }, defaultSort: "issuedAt" },
  "visa-applications": { model: "visaApplication", permission: "visa", search: ["applicationNo", "visaNumber", "country"], number: { field: "applicationNo", key: "visa", prefix: "ZAT-VS" }, branchField: "branchId" },
  agents: { model: "agent", permission: "agent", search: ["name", "company", "phone"] },
  "agent-commissions": { model: "agentCommission", permission: "agent" },
  "chart-of-accounts": { model: "chartOfAccount", permission: "account", search: ["code", "name"], defaultSort: "code" },
  journals: { model: "journalEntry", permission: "account", search: ["entryNumber", "memo"], number: { field: "entryNumber", key: "jv", prefix: "ZAT-JV" }, branchField: "branchId" },
  payments: { model: "payment", permission: "account", search: ["paymentNo"], number: { field: "paymentNo", key: "pay", prefix: "ZAT-PAY" }, branchField: "branchId" },
  receipts: { model: "receipt", permission: "account", search: ["receiptNo"], number: { field: "receiptNo", key: "rec", prefix: "ZAT-REC" }, branchField: "branchId" },
  expenses: { model: "expense", permission: "account", search: ["expenseNo", "category"], number: { field: "expenseNo", key: "exp", prefix: "ZAT-EXP" }, branchField: "branchId" },
  "bank-accounts": { model: "bankAccount", permission: "account", search: ["name", "accountNumber", "iban"], defaultSort: "name" },
  "cash-accounts": { model: "cashAccount", permission: "account", search: ["name"], defaultSort: "name" },
  employees: { model: "employee", permission: "hr", search: ["fullName", "employeeNo"], number: { field: "employeeNo", key: "emp", prefix: "ZAT-EMP" } },
  attendance: { model: "attendance", permission: "hr", defaultSort: "date" },
  holidays: { model: "holiday", permission: "hr", search: ["name"], defaultSort: "date" },
  payroll: { model: "payrollRun", permission: "hr", defaultSort: "runDate" },
  "salary-slips": { model: "salarySlip", permission: "hr", search: ["slipNo"], number: { field: "slipNo", key: "sal", prefix: "ZAT-SAL" }, defaultSort: "slipNo" },
  users: { model: "user", permission: "user", search: ["email", "username", "fullName"], omitOnWrite: ["passwordHash"] },
  roles: { model: "role", permission: "role", search: ["name"], defaultSort: "name" },
  branches: { model: "branch", permission: "branch", search: ["name", "code"] },
  documents: { model: "storedDocument", permission: "document", search: ["fileName"] },
  notifications: { model: "notification", permission: "notification", search: ["title"] },
  "audit-logs": { model: "auditLog", permission: "audit", search: ["action", "entity"] },
  "cms-pages": { model: "cmsPage", permission: "cms", search: ["slug", "title"], defaultSort: "title" },
  currencies: { model: "currency", permission: "settings", search: ["code", "name"], defaultSort: "code" },
  "exchange-rates": { model: "exchangeRate", permission: "settings" },
  "package-components": { model: "packageComponent", permission: "umrah" },
  "ziyarat-assignments": { model: "ziyaratAssignment", permission: "umrah" },
  "passenger-documents": { model: "passengerDocument", permission: "passenger" },
};

export function actionPermission(meta: ResourceMeta, action: "view" | "create" | "edit" | "delete") {
  if (meta.permission === "user") return "user.manage";
  if (meta.permission === "role") return "role.manage";
  if (meta.permission === "branch") return "branch.manage";
  if (meta.permission === "settings") return "settings.manage";
  if (meta.permission === "audit") return "audit.view";
  if (action === "view") return `${meta.permission}.view`;
  if (action === "create") return `${meta.permission}.create`;
  if (action === "edit") return `${meta.permission}.edit`;
  return `${meta.permission}.delete`;
}
