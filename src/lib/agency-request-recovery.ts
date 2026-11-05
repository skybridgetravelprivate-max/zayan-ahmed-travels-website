export type AgencyRequestDraft = {
  key: string;
  kind: string;
  subject: string;
  message: string;
};

export const agencyRequestKinds = ["ENQUIRY", "BOOKING", "CHANGE", "CANCELLATION", "PAYMENT_EVIDENCE"] as const;

export function parseAgencyRequestDraft(raw: string | null): AgencyRequestDraft | null {
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (!value || typeof value.key !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(value.key)
    || !agencyRequestKinds.includes(value.kind)
    || typeof value.subject !== "string" || !value.subject.trim() || value.subject.length > 160
    || typeof value.message !== "string" || !value.message.trim() || value.message.length > 4000) {
    throw new Error("Saved request recovery needs staff review. Keep request history available.");
  }
  return value;
}

/** Called inside the browser's shared lock before any request is sent. */
export function reserveAgencyRequest(
  storage: Pick<Storage, "getItem" | "setItem">,
  storageKey: string,
  details: Omit<AgencyRequestDraft, "key">,
  createKey: () => string,
): AgencyRequestDraft {
  const existing = parseAgencyRequestDraft(storage.getItem(storageKey));
  if (existing) return existing;
  const draft = { ...details, key: createKey() };
  const serialized = JSON.stringify(draft);
  parseAgencyRequestDraft(serialized);
  storage.setItem(storageKey, serialized);
  if (storage.getItem(storageKey) !== serialized) throw new Error("Recovery details could not be saved.");
  return draft;
}

/** A late response may only clear its own submission. */
export function clearAgencyRequest(
  storage: Pick<Storage, "getItem" | "removeItem">,
  storageKey: string,
  requestKey: string,
) {
  const draft = parseAgencyRequestDraft(storage.getItem(storageKey));
  if (draft?.key !== requestKey) return false;
  storage.removeItem(storageKey);
  return true;
}
