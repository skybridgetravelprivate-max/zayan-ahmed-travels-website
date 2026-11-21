"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  canStartNewQuotation,
  releaseQuotationKey,
  savedQuotationAttempts,
  type DeliveryState,
} from "@/lib/communication-recovery";

type Submission = {
  id: string;
  status: Exclude<DeliveryState, "MISSING">;
  channel?: "EMAIL" | "WHATSAPP";
  providerReference: string | null;
  userId?: string;
};
type OwnResult = {
  key: string;
  email: Submission | null;
  whatsapp: Submission | null;
};
const control =
  "mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-foreground";
const button =
  "min-h-11 rounded-lg border border-line px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue disabled:opacity-50";
const label = (state: DeliveryState) =>
  ({
    SENT: "Accepted by transport",
    NOT_SENT: "Confirmed not accepted",
    UNCERTAIN: "Uncertain — do not resend",
    MISSING: "No submission found",
  })[state];

async function request(path: string, body?: object, missing = false) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (response.status === 404 && missing) return null;
  if (response.status === 401)
    throw Error("Your staff session expired. Sign in again.");
  if (response.status === 403)
    throw Error("You do not have permission to review this submission.");
  if (response.status === 409)
    throw Error(
      "The outcome changed. Read the submission again before reviewing it.",
    );
  if (!response.ok)
    throw Error(
      "The outcome could not be confirmed. Keep the original key and check again.",
    );
  const row: Submission = await response.json();
  if (
    !row ||
    typeof row.id !== "string" ||
    !["SENT", "NOT_SENT", "UNCERTAIN"].includes(row.status) ||
    (row.providerReference != null && typeof row.providerReference !== "string")
  )
    throw Error("Submission response could not be verified.");
  return { ...row, providerReference: row.providerReference ?? null };
}

async function ownStatuses(key: string): Promise<OwnResult> {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw Error(
      "Enter the original submission key (8–100 letters, digits, underscores or hyphens).",
    );
  const [email, whatsapp] = await Promise.all(
    ["email", "whatsapp"].map((channel) =>
      request(
        `/api/v1/comms/${channel}/submission/${encodeURIComponent(key)}`,
        undefined,
        true,
      ),
    ),
  );
  return { key, email, whatsapp };
}

const states = (result: OwnResult): DeliveryState[] => [
  result.email?.status ?? "MISSING",
  result.whatsapp?.status ?? "MISSING",
];

export function CommunicationRecovery({
  username,
  canReconcile,
}: {
  username: string;
  canReconcile: boolean;
}) {
  const [attempts, setAttempts] = useState<
    ReturnType<typeof savedQuotationAttempts>
  >([]);
  const [selected, setSelected] = useState("");
  const [key, setKey] = useState("");
  const [own, setOwn] = useState<OwnResult | null>(null);
  const [reviewId, setReviewId] = useState("");
  const [review, setReview] = useState<Submission | null>(null);
  const [verified, setVerified] = useState(false);
  const [newIntent, setNewIntent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  function refreshSaved() {
    setAttempts(savedQuotationAttempts(localStorage, username));
  }
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      setOwn(null);
      setReview(null);
      setVerified(false);
      setNewIntent(false);
      setError(
        cause instanceof Error &&
          !["TypeError", "TimeoutError"].includes(cause.name)
          ? cause.message
          : "Outcome is uncertain. Keep the original key and read the submission again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const attempt = attempts.find(
    (item) => item.identity === selected && item.key === key,
  );
  async function lookup() {
    setOwn(null);
    setNewIntent(false);
    setOwn(await ownStatuses(key));
  }
  async function release() {
    if (!attempt || !newIntent || !navigator.locks)
      throw Error(
        "Select the saved attempt and confirm a new submission after review. A browser with cross-tab coordination is required.",
      );
    await navigator.locks.request(
      `zat:message-key:${attempt.identity}`,
      async () => {
        const fresh = await ownStatuses(attempt.key);
        releaseQuotationKey(
          localStorage,
          attempt.identity,
          attempt.key,
          states(fresh),
        );
      },
    );
    refreshSaved();
    setSelected("");
    setOwn(null);
    setKey("");
    setNewIntent(false);
    setMessage(
      "Saved key released after confirmed non-acceptance. No message was sent. Return to the quotation to deliberately start a new submission.",
    );
  }
  async function readReview() {
    if (!/^(email|whatsapp):[a-f0-9]{64}$/.test(reviewId))
      throw Error(
        "Enter the full submission identity shown in its status result.",
      );
    setReview(null);
    setVerified(false);
    const row = await request(
      `/api/v1/comms/submissions/${encodeURIComponent(reviewId)}`,
    );
    if (!row?.channel || !["EMAIL", "WHATSAPP"].includes(row.channel))
      throw Error("Submission channel could not be verified.");
    setReview(row);
  }
  async function reconcile(data: FormData) {
    if (!review || review.status !== "UNCERTAIN" || !verified)
      throw Error(
        "Read the uncertain submission and independently confirm its outcome first.",
      );
    const status = String(data.get("status")),
      reason = String(data.get("reason") ?? "").trim(),
      reference = String(data.get("reference") ?? "").trim();
    if (!["SENT", "NOT_SENT"].includes(status) || !reason)
      throw Error(
        "Choose a confirmed outcome and record the evidence in a review reason.",
      );
    const row = review;
    await request(
      `/api/v1/comms/${row.channel!.toLowerCase()}/${encodeURIComponent(row.id)}/reconcile`,
      {
        status,
        reason,
        ...(reference ? { providerReference: reference } : {}),
      },
    );
    // Acknowledgement alone does not authorize a resend; reread committed state.
    await readReview();
    setMessage("Review saved. This action did not send a message.");
  }
  return (
    <section className="min-w-0 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zayan-blue">
          Communication recovery
        </h1>
        <p className="mt-2 text-muted">
          Check saved attempts before retrying. Transport acceptance is not
          proof of recipient delivery. A timeout alone does not mean a message
          was not sent.
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-line bg-surface p-3"
        >
          {message}
        </p>
      )}
      <section
        className="rounded-2xl border border-line p-5"
        aria-labelledby="my-submissions"
      >
        <h2 id="my-submissions" className="text-xl font-semibold">
          My submission status
        </h2>
        <p className="mt-2 text-muted">
          Only attempts submitted by your current staff account are returned.
          Keep the key until review is complete.
        </p>
        <button
          className={`${button} mt-4`}
          disabled={busy}
          onClick={() =>
            void run(async () => {
              refreshSaved();
            })
          }
        >
          Load saved quotation attempts
        </button>
        <div className="mt-4">
          <label htmlFor="saved-quotation">Saved quotation attempt</label>
          <select
            id="saved-quotation"
            className={control}
            value={selected}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              setSelected(value);
              const item = attempts.find((entry) => entry.identity === value);
              setKey(item?.key ?? "");
              setOwn(null);
              setNewIntent(false);
            }}
          >
            <option value="">Enter a key manually</option>
            {attempts.map((item) => (
              <option key={item.identity} value={item.identity}>
                Quotation {item.recordId}
              </option>
            ))}
          </select>
        </div>
        <form className="mt-4 space-y-3" action={() => run(lookup)}>
          <label className="block">
            Original submission key
            <input
              className={control}
              value={key}
              required
              maxLength={100}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => {
                setKey(event.target.value);
                setSelected("");
                setOwn(null);
                setNewIntent(false);
              }}
            />
          </label>
          <button className={button} disabled={busy}>
            Check my submission
          </button>
        </form>
        {own && (
          <div className="mt-4 space-y-3" aria-live="polite">
            {(["email", "whatsapp"] as const).map((channel) => {
              const row = own[channel];
              return (
                <div key={channel} className="rounded-lg bg-surface p-3">
                  <h3 className="font-semibold">
                    {channel === "email" ? "Email" : "WhatsApp"}:{" "}
                    {label(row?.status ?? "MISSING")}
                  </h3>
                  {row && (
                    <>
                      <p className="mt-1 break-all text-sm">
                        Submission identity: {row.id}
                      </p>
                      {row.providerReference && (
                        <p className="break-all text-sm">
                          Transport reference: {row.providerReference}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <p className="text-sm text-muted">
              Ask a Super Admin to review an uncertain outcome using the
              submission identity. Do not replace the key to bypass an uncertain
              result.
            </p>
            {attempt && (
              <div className="space-y-3 border-t border-line pt-3">
                <Link
                  href={`/admin/manage/quotations?record=${encodeURIComponent(attempt.recordId)}`}
                  className="inline-block underline"
                >
                  Return to quotation
                </Link>
                <p className="text-sm">
                  A new quotation attempt is allowed here only when every
                  existing channel is confirmed not accepted. An accepted or
                  uncertain channel keeps the key in place.
                </p>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={newIntent}
                    disabled={busy || !canStartNewQuotation(states(own))}
                    onChange={(event) => setNewIntent(event.target.checked)}
                  />
                  I reviewed confirmed non-acceptance and want to prepare a new
                  submission.
                </label>
                <button
                  className={button}
                  disabled={
                    busy || !newIntent || !canStartNewQuotation(states(own))
                  }
                  onClick={() => void run(release)}
                >
                  Prepare new quotation submission
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      {canReconcile && (
        <section
          className="rounded-2xl border border-line p-5"
          aria-labelledby="admin-review"
        >
          <h2 id="admin-review" className="text-xl font-semibold">
            Super Admin outcome review
          </h2>
          <p className="mt-2 text-muted">
            Confirm the outcome independently with the provider. Do not confirm
            non-acceptance while an attempt could still be in flight.
          </p>
          <form className="mt-4 space-y-3" action={() => run(readReview)}>
            <label className="block">
              Submission identity
              <input
                className={control}
                required
                maxLength={80}
                value={reviewId}
                disabled={busy}
                autoComplete="off"
                onChange={(event) => {
                  setReviewId(event.target.value);
                  setReview(null);
                  setVerified(false);
                }}
              />
            </label>
            <button className={button} disabled={busy}>
              Read submission for review
            </button>
          </form>
          {review && (
            <div className="mt-4 rounded-lg bg-surface p-4">
              <p className="font-semibold">
                Current outcome: {label(review.status)}
              </p>
              <p className="mt-1 break-all text-sm">
                Channel: {review.channel}. Submitted by staff identity:{" "}
                {review.userId}
              </p>
              {review.providerReference && (
                <p className="break-all text-sm">
                  Transport reference: {review.providerReference}
                </p>
              )}
              {review.status === "UNCERTAIN" ? (
                <form
                  className="mt-4 space-y-3"
                  action={(data) => run(() => reconcile(data))}
                  key={review.id}
                >
                  <div>
                    <label htmlFor="confirmed-outcome">
                      Independently confirmed outcome
                    </label>
                    <select
                      id="confirmed-outcome"
                      name="status"
                      className={control}
                      required
                      disabled={busy}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Choose confirmed outcome
                      </option>
                      <option value="SENT">Accepted by transport</option>
                      <option value="NOT_SENT">Confirmed not accepted</option>
                    </select>
                  </div>
                  <label className="block">
                    Review reason and evidence
                    <textarea
                      name="reason"
                      className={control}
                      required
                      maxLength={1000}
                      rows={3}
                      disabled={busy}
                    />
                  </label>
                  <label className="block">
                    Transport reference (optional)
                    <input
                      name="reference"
                      className={control}
                      maxLength={200}
                      disabled={busy}
                    />
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      required
                      checked={verified}
                      disabled={busy}
                      onChange={(event) => setVerified(event.target.checked)}
                    />
                    I independently verified this outcome. A timeout was not my
                    only evidence.
                  </label>
                  <button className={button} disabled={busy || !verified}>
                    Save audited outcome
                  </button>
                </form>
              ) : (
                <p className="mt-3">
                  This submission is already resolved. Its original key remains
                  in the server history.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
