/** The accounting workspace deliberately excludes unrelated CRM/HR/CMS tools.
 * This is presentation configuration, never an authorization policy. */
const profile: Record<string, { title: string; group: string }> = {
  customers: { title: "Customer accounts", group: "Accounts" },
  passengers: { title: "Passengers", group: "Accounts" },
  suppliers: { title: "Supplier accounts", group: "Accounts" },
  agents: { title: "Agent accounts", group: "Accounts" },
  "chart-of-accounts": { title: "Chart of accounts", group: "Accounts" },
  journals: { title: "Journal vouchers", group: "Vouchers" },
  "service-invoices": { title: "General invoices", group: "Vouchers" },
  receipts: { title: "Customer receipts", group: "Vouchers" },
  payments: { title: "Supplier payments", group: "Vouchers" },
  expenses: { title: "Expenses", group: "Vouchers" },
  "bank-accounts": { title: "Bank accounts", group: "Accounts" },
  "cash-accounts": { title: "Cash accounts", group: "Accounts" },
  quotations: { title: "Quotations", group: "Travel invoices" },
  tickets: { title: "Full ticket vouchers", group: "Travel invoices" },
  "ticket-refunds": { title: "Refunded tickets", group: "Travel invoices" },
  "ticket-reissues": { title: "Ticket reissues", group: "Travel invoices" },
  "issued-ticket-invoices": { title: "Issued ticket invoices", group: "Travel invoices" },
  pnr: { title: "PNR records", group: "Group tickets" },
  "ticket-groups": { title: "Group seat inventory", group: "Group tickets" },
  "hotel-bookings": { title: "Hotel invoices", group: "Travel invoices" },
  "hotel-vouchers": { title: "Hotel vouchers", group: "Travel invoices" },
  "visa-applications": { title: "Visa invoices", group: "Travel invoices" },
  "transport-bookings": { title: "Transport invoices", group: "Travel invoices" },
  "transport-vouchers": { title: "Transport vouchers", group: "Travel invoices" },
  "umrah-bookings": { title: "Package bookings", group: "Packages" },
  "umrah-packages": { title: "Package catalogue", group: "Packages" },
  "umrah-groups": { title: "Package groups", group: "Packages" },
  "umrah-visas": { title: "Package visas", group: "Packages" },
  hotels: { title: "Hotels", group: "Setup" },
  airlines: { title: "Airlines", group: "Setup" },
  currencies: { title: "Currencies", group: "Setup" },
  "exchange-rates": { title: "Exchange rates", group: "Setup" },
  "payment-methods": { title: "Payment methods", group: "Setup" },
  "visa-types": { title: "Visa types", group: "Setup" },
  users: { title: "Users", group: "Administration" },
  roles: { title: "Permissions", group: "Administration" },
  branches: { title: "Branches", group: "Administration" },
  "audit-logs": { title: "Audit history", group: "Administration" },
  "communication-recovery": { title: "Communication recovery", group: "Administration" },
};

export function accountingModules<T extends { key: string; title: string; group: string }>(modules: T[]): T[] {
  const order = ["Accounts", "Vouchers", "Travel invoices", "Packages", "Group tickets", "Setup", "Administration"];
  return modules.filter(module => Object.hasOwn(profile, module.key))
    .map(module => ({ ...module, ...profile[module.key] }))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export const accountingQuickKeys = ["journals", "receipts", "payments", "quotations", "tickets", "hotel-bookings", "visa-applications", "transport-bookings"];
