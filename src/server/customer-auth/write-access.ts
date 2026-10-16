export class CustomerWritesDisabledError extends Error {
  constructor() {
    super("Customer account writes are temporarily unavailable.");
  }
}

export function customerWritesEnabled() {
  const configured = process.env.CUSTOMER_WRITES_ENABLED;
  if (configured === undefined) return process.env.NODE_ENV !== "production";
  return configured.trim().toLowerCase() === "true";
}

export function assertCustomerWritesEnabled() {
  if (!customerWritesEnabled()) throw new CustomerWritesDisabledError();
}
