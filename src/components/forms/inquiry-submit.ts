type PendingInquiry = { body: string; key: string };

export async function submitInquiry(pending: { current: PendingInquiry | null }, body: string) {
  if (pending.current?.body !== body) {
    pending.current = { body, key: crypto.randomUUID() };
  }
  return fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key },
    body,
  });
}
