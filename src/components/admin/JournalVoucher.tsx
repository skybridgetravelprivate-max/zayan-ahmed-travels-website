"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { ReferenceInput } from "./ManagementWorkspace";
import { canonicalMoney } from "@/lib/staff-management";
import { receiptRetryKey, savedReceiptRetryKey, clearReceiptRetry } from "@/lib/receipt-retry";

type Line = { id: number; debit: string; credit: string; party: string };
const control = "w-full rounded border border-line bg-white px-3 py-2";
const button = "rounded border border-line bg-white px-4 py-2 disabled:opacity-50";
const zero = (): Line[] => [{ id: 0, debit: "", credit: "", party: "" }, { id: 1, debit: "", credit: "", party: "" }];
const subscribeStorage = (changed: () => void) => { window.addEventListener("storage", changed); return () => window.removeEventListener("storage", changed); };
const cents = (text: string) => BigInt(canonicalMoney(text || "0").replace(".", ""));
const amount = (value: bigint) => `${value < BigInt(0) ? "-" : ""}${(value < BigInt(0) ? -value : value) / BigInt(100)}.${String((value < BigInt(0) ? -value : value) % BigInt(100)).padStart(2, "0")}`;

export function JournalVoucher({ username, cash = false }: { username: string; cash?: boolean }) {
  const [revision, setRevision] = useState(0);
  return <JournalVoucherForm key={revision} username={username} cash={cash} onNew={() => setRevision(value => value + 1)} />;
}

function JournalVoucherForm({ username, cash, onNew }: { username: string; cash: boolean; onNew: () => void }) {
  const [lines, setLines] = useState<Line[]>(() => cash ? zero().slice(0, 1) : zero());
  const serial = useRef(2);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [recovery, setRecovery] = useState(false);
  const scope = `${cash ? "cash" : "manual"}-voucher:${username}`;
  const savedKey = useSyncExternalStore(subscribeStorage, () => { try { return savedReceiptRetryKey(localStorage, scope) || ""; } catch { return "!unavailable"; } }, () => "!loading");
  const storageBlocked = savedKey.startsWith("!");

  function update(id: number, key: "debit" | "credit" | "party", value: string) { setLines(prior => prior.map(line => line.id === id ? { ...line, [key]: value } : line)); }
  let debit = BigInt(0), credit = BigInt(0), valid = true;
  try { for (const line of lines) { const d = cents(line.debit), c = cents(line.credit); debit += d; credit += c; if ((d === BigInt(0)) === (c === BigInt(0))) valid = false; } } catch { valid = false; }

  async function recover() {
    setBusy(true); setError("");
    try {
      const key = savedReceiptRetryKey(localStorage, scope);
      if (!key) throw new Error("No pending voucher is saved in this browser.");
      const response = await fetch(`/api/v1/finance/vouchers/submission/${encodeURIComponent(key)}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Voucher is not confirmed. Re-enter its original details and retry; do not start another voucher.");
      const result = await response.json();
      if (typeof result.entryNumber !== "string") throw new Error("Voucher confirmation is unavailable.");
      setSaved(result.entryNumber); clearReceiptRetry(localStorage, scope); setRecovery(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Voucher recovery unavailable."); } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || busy || saved || !valid || (!cash && debit !== credit) || debit + credit === BigInt(0)) return;
    const form = new FormData(event.currentTarget);
    if (form.get("review") !== "yes") return;
    pending.current = true; setBusy(true); setError("");
    try {
      const payload = { date: String(form.get("date")), memo: String(form.get("memo")), lines: lines.map(line => ({ accountId: String(form.get(`account_${line.id}`) || ""), debit: canonicalMoney(line.debit || "0"), credit: canonicalMoney(line.credit || "0"), memo: String(form.get(`memo_${line.id}`) || ""), ...(line.party ? { partyType: line.party, partyId: String(form.get(`party_${line.id}`) || "") } : {}) })) };
      const key = await receiptRetryKey(localStorage, scope, payload);
      setRecovery(true);
      const response = await fetch(`/api/v1/finance/${cash ? "cash-vouchers" : "vouchers"}`, { method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if ([400, 404].includes(response.status)) {
        clearReceiptRetry(localStorage, scope); setRecovery(false);
        throw new Error("Voucher was rejected without posting. Check that accounts are active, receivable/payable parties match the voucher branch, and each line has either debit or credit.");
      }
      if (!response.ok) throw new Error("Voucher was not confirmed. Check accounts, parties and amounts; retain the original details for retry or check saved submission.");
      const result = await response.json();
      if (typeof result.entryNumber !== "string") throw new Error("Voucher confirmation is unavailable. Check saved submission.");
      setSaved(result.entryNumber); clearReceiptRetry(localStorage, scope); setRecovery(false);
    } catch (e) { setError(e instanceof Error && /receipt/i.test(e.message) ? "An earlier voucher is unconfirmed. Retry its original details or check saved submission before starting another." : e instanceof Error ? e.message : "Voucher was not confirmed."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <section className="space-y-4"><header><h1>{cash ? "Cash voucher" : "Journal voucher"}</h1><p>{cash ? "Record cash payments and receipts in PKR against ledger accounts in your default branch." : "Post a balanced journal in PKR to your default branch."} Voucher dates are recorded at UTC midnight. This records ledger entries; it does not transfer money or settle booking balances. Use customer receipts and supplier payments for settlements.</p></header>
    {error && <p role="alert">{error}</p>}{savedKey === "!unavailable" && <p role="alert">Saved voucher recovery is unavailable. Review voucher history before posting.</p>}{saved && <div><p role="status">Voucher confirmed: {saved}.</p><Link className="mr-4 underline" href="/admin/manage/journals">Review journal history</Link><button className="underline" type="button" onClick={onNew}>Start another voucher</button></div>}
    {(recovery || (savedKey && !storageBlocked)) && <div className="rounded border border-line bg-white p-4"><p>An earlier voucher submission needs confirmation. Preserve its original details.</p><button className={button} type="button" disabled={busy} onClick={() => void recover()}>Check saved submission</button></div>}
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy || !!saved || storageBlocked} className="space-y-4"><legend className="sr-only">Voucher details</legend>
      <div className="grid gap-3 sm:grid-cols-2"><label>Date (UTC)<input className={control} name="date" type="date" required /></label><label>Description<input className={control} name="memo" maxLength={500} required /></label></div>
      {lines.map((line, index) => <fieldset key={line.id} className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"><legend>Line {index + 1}</legend>
        <div><ReferenceInput field={{ name: `account_${line.id}`, label: `Account for line ${index + 1}`, type: "String", reference: "chart-of-accounts", required: true, nullable: false }} value="" disabled={busy || !!saved} /></div>
        <label>Description<input className={control} name={`memo_${line.id}`} maxLength={500} /></label>
        <label>{cash ? "Payment" : "Debit"}<input className={control} inputMode="decimal" value={line.debit} onChange={e => update(line.id, "debit", e.target.value)} /></label>
        <label>{cash ? "Receipt" : "Credit"}<input className={control} inputMode="decimal" value={line.credit} onChange={e => update(line.id, "credit", e.target.value)} /></label>
        <label>Party type<select className={control} value={line.party} onChange={e => update(line.id, "party", e.target.value)}><option value="">No party</option><option value="customer">Customer</option><option value="supplier">Supplier</option></select></label>
        {line.party && <ReferenceInput key={line.party} field={{ name: `party_${line.id}`, label: `Party for line ${index + 1}`, type: "String", reference: line.party === "customer" ? "customers" : "suppliers", required: true, nullable: false }} value="" disabled={busy || !!saved} />}
        <button className={button} type="button" disabled={lines.length <= (cash ? 1 : 2)} onClick={() => setLines(prior => prior.filter(item => item.id !== line.id))}>Remove line {index + 1}</button>
      </fieldset>)}
      <button type="button" className={button} disabled={lines.length >= (cash ? 100 : 200)} onClick={() => setLines(prior => [...prior, { id: serial.current++, debit: "", credit: "", party: "" }])}>Add line</button>
      <p aria-live="polite">{valid ? cash ? `Total payment ${amount(debit)} · Total receipt ${amount(credit)} · Cash movement ${amount(credit - debit)}` : `Debit ${amount(debit)} · Credit ${amount(credit)} · Difference ${amount(debit - credit)}` : "Use a debit or a credit on every line, with up to two decimal places."}</p>
      <label className="flex gap-2"><input type="checkbox" name="review" value="yes" required />I reviewed the accounts, parties and balanced amounts and authorize posting this voucher.</label>
      <button className={button} disabled={!valid || (!cash && debit !== credit) || debit + credit === BigInt(0)}>{cash ? "Post cash voucher" : "Post journal voucher"}</button>
    </fieldset></form></section>;
}

