"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { clearAgencyRequest, parseAgencyRequestDraft, reserveAgencyRequest, type AgencyRequestDraft } from "@/lib/agency-request-recovery";

const recoveryChanged = "zat-agency-recovery-changed";

export function AgencyRequestForm({ agencyId, userId, refreshHistory }: {
  agencyId: string;
  userId: string;
  refreshHistory: () => Promise<void>;
}) {
  const storageKey = `zat-agency-request:${agencyId}:${userId}`;
  const subscribe = useCallback((notify: () => void) => {
    const changed = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) notify();
    };
    window.addEventListener("storage", changed);
    window.addEventListener(recoveryChanged, notify);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener(recoveryChanged, notify);
    };
  }, [storageKey]);
  const getSnapshot = useCallback(() => {
    try { return localStorage.getItem(storageKey); }
    catch { return "unavailable"; }
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  let draft: AgencyRequestDraft | null = null;
  let recoveryError = "";
  try { draft = parseAgencyRequestDraft(raw); }
  catch { recoveryError = "Saved request recovery is unavailable. Review history with staff before submitting again."; }
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const busy = useRef(false);

  async function locked<T>(action: () => T | Promise<T>) {
    if (!navigator.locks) throw new Error("Shared-browser request coordination is unavailable.");
    return navigator.locks.request(storageKey, action);
  }

  function notify() { window.dispatchEvent(new Event(recoveryChanged)); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || recoveryError) return;
    const fields = new FormData(event.currentTarget);
    const details = draft ? { kind: draft.kind, subject: draft.subject, message: draft.message } : {
      kind: String(fields.get("kind")),
      subject: String(fields.get("subject")).trim(),
      message: String(fields.get("message")).trim(),
    };
    busy.current = true;
    setPending(true);
    setNotice("");
    setReviewedKey(null);
    let sent = false;
    try {
      const attempt = await locked(() => reserveAgencyRequest(localStorage, storageKey, details, () => crypto.randomUUID()));
      notify();
      if (attempt.kind !== details.kind || attempt.subject !== details.subject || attempt.message !== details.message) {
        setNotice("An earlier request is awaiting confirmation. Retry its saved details or review history.");
        return;
      }
      sent = true;
      const response = await fetch("/api/v1/agent/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key },
        body: JSON.stringify({ kind: attempt.kind, subject: attempt.subject, message: attempt.message }),
      });
      if (!response.ok) throw new Error("Unconfirmed submission");
      // The accepted result remains confirmed even if local cleanup/history fails.
      setNotice("Request received for staff review. Staff will confirm any booking or financial action separately.");
      try {
        await locked(() => clearAgencyRequest(localStorage, storageKey, attempt.key));
        notify();
      } catch {
        setNotice("Request received. Recovery cleanup failed, so review history before starting another request.");
      }
      try { await refreshHistory(); } catch { /* Retain the confirmed submission notice. */ }
    } catch {
      notify();
      setNotice(sent ? "Submission is unconfirmed. Keep the saved details and retry, or review history with staff." : "Request was not sent. Recovery storage or shared-browser coordination is unavailable.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function reviewHistory() {
    setReviewedKey(null);
    try {
      await refreshHistory();
      setReviewedKey(draft?.key || null);
      setNotice("Review the history below. Retry an unresolved submission or contact staff before starting another.");
    } catch { setNotice("History could not be loaded. Keep the saved request and retry later."); }
  }

  async function startNew() {
    if (!draft || reviewedKey !== draft.key) return;
    const key = reviewedKey;
    try {
      const cleared = await locked(() => clearAgencyRequest(localStorage, storageKey, key));
      notify();
      if (!cleared) { setNotice("Saved request changed in another tab. Review its history before continuing."); return; }
      setReviewedKey(null);
      setNotice("Earlier request history reviewed. A new submission will have a separate identity.");
    } catch { setNotice("Saved recovery could not be cleared. Contact staff before submitting again."); }
  }

  return <form onSubmit={submit} className="my-6 space-y-4 rounded-xl border border-line p-5">
    <h2 className="text-xl font-bold">{draft ? "Recover saved request" : "New request"}</h2>
    <label className="block">Request type
      <select key={draft?.key || "new-kind"} name="kind" defaultValue={draft?.kind || "ENQUIRY"} disabled={pending || !!draft || !!recoveryError} className="mt-2 block w-full rounded-lg border p-3">
        <option value="ENQUIRY">Quotation enquiry</option><option value="BOOKING">Booking request</option>
        <option value="CHANGE">Change request</option><option value="CANCELLATION">Cancellation review</option>
        <option value="PAYMENT_EVIDENCE">Payment reference for review</option>
      </select>
    </label>
    <label className="block">Subject<input key={draft?.key || "new-subject"} name="subject" defaultValue={draft?.subject} required maxLength={160} readOnly={!!draft} disabled={pending || !!recoveryError} className="mt-2 block w-full rounded-lg border p-3" /></label>
    <label className="block">Message<textarea key={draft?.key || "new-message"} name="message" defaultValue={draft?.message} required maxLength={4000} readOnly={!!draft} disabled={pending || !!recoveryError} className="mt-2 block min-h-32 w-full rounded-lg border p-3" /></label>
    <p className="text-sm text-muted">Include the package or booking reference. Keep passwords, card details and identity-document numbers out of messages. Staff review payment references before recording cleared funds.</p>
    <div className="flex flex-wrap gap-4">
      <button disabled={pending || !!recoveryError} className="min-h-11 rounded-lg bg-zayan-blue px-5 py-3 font-bold text-white">{pending ? "Submitting…" : draft ? "Retry saved request" : "Send for staff review"}</button>
      {(draft || recoveryError) && <button disabled={pending} type="button" onClick={reviewHistory} className="underline">Review request history</button>}
      {draft && reviewedKey === draft.key && <button disabled={pending} type="button" onClick={startNew} className="underline">Start a new request after reviewing history</button>}
    </div>
    {(recoveryError || notice) && <p role="status" className="rounded-lg bg-sky-50 p-4">{recoveryError || notice}</p>}
  </form>;
}
