type RetryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storageKey = (staffUsername: string) => `zat:pending-receipt:${staffUsername}`;

export function hasPendingReceipt(storage: RetryStorage, staffUsername: string) {
  return storage.getItem(storageKey(staffUsername)) !== null;
}

export function clearReceiptRetry(storage: RetryStorage, staffUsername: string) {
  storage.removeItem(storageKey(staffUsername));
}

export function savedReceiptRetryKey(storage: RetryStorage, staffUsername: string): string | null {
  const prior = storage.getItem(storageKey(staffUsername));
  if (prior === null) return null;
  const value = JSON.parse(prior);
  if (!value || typeof value.key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(value.key)) throw new Error("Receipt retry information is unavailable. Review receipt history.");
  return value.key;
}

/** Persist only a fingerprint and retry key, never receipt fields or credentials. */
export async function receiptRetryKey(storage: RetryStorage, staffUsername: string, payload: Record<string, unknown>) {
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  const key = storageKey(staffUsername);
  const prior = storage.getItem(key);
  if (prior !== null) {
    let pending: { fingerprint?: unknown; key?: unknown };
    try { pending = JSON.parse(prior); } catch { throw new Error("Receipt retry information is unavailable. Review receipt history before starting another payment."); }
    if (!pending || pending.fingerprint !== fingerprint || typeof pending.key !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(pending.key)) throw new Error("An earlier receipt is unconfirmed. Retry its original details, or review receipt history before starting another payment.");
    return pending.key;
  }
  const pending = JSON.stringify({ fingerprint, key: crypto.randomUUID() });
  storage.setItem(key, pending);
  if (storage.getItem(key) !== pending) throw new Error("Receipt retry information could not be saved. Payment was not submitted.");
  return (JSON.parse(pending) as { key: string }).key;
}
