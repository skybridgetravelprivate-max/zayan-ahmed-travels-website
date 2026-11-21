import { clearReceiptRetry, savedReceiptRetryKey } from "./receipt-retry";

export type DeliveryState = "SENT" | "UNCERTAIN" | "NOT_SENT" | "MISSING";
type StorageRead = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;

export function savedQuotationAttempts(storage: StorageRead, username: string) {
  const prefix = `zat:pending-receipt:${username}:quotation-send:`;
  const attempts: { identity: string; recordId: string; key: string }[] = [];
  for (let index = 0; index < storage.length && index < 10000; index++) {
    const name = storage.key(index);
    if (!name?.startsWith(prefix)) continue;
    const recordId = name.slice(prefix.length);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(recordId))
      throw Error(
        "Saved quotation identity is unavailable. Keep the original key and contact an administrator.",
      );
    const identity = `${username}:quotation-send:${recordId}`;
    const key = savedReceiptRetryKey(storage, identity);
    if (key) attempts.push({ identity, recordId, key });
    if (attempts.length >= 50) break;
  }
  return attempts;
}

export function canStartNewQuotation(states: DeliveryState[]) {
  return (
    states.length === 2 &&
    states.includes("NOT_SENT") &&
    states.every((state) => state === "NOT_SENT" || state === "MISSING")
  );
}

/** Caller must hold the same quotation Web Lock and fetch fresh server states. */
export function releaseQuotationKey(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  identity: string,
  key: string,
  states: DeliveryState[],
) {
  if (
    !canStartNewQuotation(states) ||
    savedReceiptRetryKey(storage, identity) !== key
  )
    throw Error(
      "The saved attempt changed or still requires review. Its key was retained.",
    );
  clearReceiptRetry(storage, identity);
}
