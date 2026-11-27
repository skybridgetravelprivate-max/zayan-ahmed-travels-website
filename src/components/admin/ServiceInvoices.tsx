"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ReferenceInput } from "./ManagementWorkspace";
import { canonicalMoney } from "@/lib/staff-management";
import { receiptRetryKey, savedReceiptRetryKey, clearReceiptRetry } from "@/lib/receipt-retry";

type Line = { id: number; description: string; qty: string; sell: string; buy: string };
type Summary = { id: string; invoiceNumber: string; date: string; status: string; net: string; cost: string; paid: string; customer: { fullName: string } | null; supplier: { name: string } | null };
const initial = (): Line[] => [{ id: 0, description: "", qty: "1", sell: "", buy: "" }];
const control = "w-full rounded border border-line bg-white px-3 py-2";
const button = "rounded border border-line bg-white px-4 py-2 disabled:opacity-50";
const cents = (text: string) => BigInt(canonicalMoney(text || "0").replace(".", ""));
const formatted = (value: bigint) => `${value < BigInt(0) ? "-" : ""}${(value < BigInt(0) ? -value : value) / BigInt(100)}.${String((value < BigInt(0) ? -value : value) % BigInt(100)).padStart(2, "0")}`;

export function ServiceInvoices({ username }: { username: string }) {
  const [revision, setRevision] = useState(0);
  return <ServiceInvoiceForm key={revision} username={username} onNew={() => setRevision(v => v + 1)} />;
}

function ServiceInvoiceForm({ username, onNew }: { username: string; onNew: () => void }) {
  const [lines, setLines] = useState<Line[]>(initial);
  const serial = useRef(1), submitting = useRef(false);
  const [tax, setTax] = useState(""), [discount, setDiscount] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState("");
  const [history, setHistory] = useState<{ rows: Summary[]; total: number; page: number } | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [receiptInvoice, setReceiptInvoice] = useState<Summary | null>(null);
  const scope = `service-voucher:${username}`;
  async function load(page = 1) {
    setHistoryError("");
    try {
      const response = await fetch(`/api/v1/finance/service-vouchers?page=${page}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Invoice history is unavailable.");
      const data = await response.json();
      if (!Array.isArray(data.rows) || data.rows.some((row: Summary) => !row || typeof row.id !== "string" || typeof row.invoiceNumber !== "string" || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(row.date) || typeof row.status !== "string" || [row.net, row.cost, row.paid].some(value => typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) || (row.customer !== null && typeof row.customer?.fullName !== "string") || (row.supplier !== null && typeof row.supplier?.name !== "string")) || !Number.isSafeInteger(data.total) || data.page !== page) throw new Error("Invoice history could not be verified.");
      setHistory(data);
    } catch (e) { setHistoryError(e instanceof Error ? e.message : "Invoice history is unavailable."); }
  }
  useEffect(() => { void load(); }, []);
  let sell = BigInt(0), buy = BigInt(0), net = BigInt(0), valid = true;
  try {
    for (const line of lines) {
      if (!/^\d+$/.test(line.qty) || Number(line.qty) < 1 || Number(line.qty) > 2147483647 || !line.description.trim() || !line.sell || !line.buy) { valid = false; continue; }
      sell += cents(line.sell) * BigInt(line.qty); buy += cents(line.buy) * BigInt(line.qty);
    }
    net = sell + cents(tax) - cents(discount);
    if (net < BigInt(0)) valid = false;
  } catch { valid = false; }
  const change = (id: number, key: keyof Omit<Line, "id">, value: string) => setLines(prior => prior.map(line => line.id === id ? { ...line, [key]: value } : line));

  async function confirmSaved() {
    setBusy(true); setError("");
    try {
      const key = savedReceiptRetryKey(localStorage, scope);
      if (!key) throw new Error("No pending invoice submission is saved in this browser.");
      const response = await fetch(`/api/v1/finance/service-vouchers/submission/${encodeURIComponent(key)}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Invoice is unconfirmed. Retry its original details before starting another invoice.");
      const result = await response.json();
      if (typeof result.invoiceNumber !== "string") throw new Error("Invoice confirmation is unavailable.");
      setSaved(result.invoiceNumber); clearReceiptRetry(localStorage, scope); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Invoice recovery is unavailable."); } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || busy || saved || !valid) return;
    const form = new FormData(event.currentTarget);
    if (form.get("review") !== "yes") return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const payload = { date: String(form.get("date")), branchId: String(form.get("branchId") || "") || undefined, customerId: String(form.get("customerId") || ""), supplierId: String(form.get("supplierId") || "") || undefined, notes: String(form.get("notes") || ""), tax: canonicalMoney(tax || "0"), discount: canonicalMoney(discount || "0"), lines: lines.map(line => ({ description: line.description, qty: Number(line.qty), unitPrice: canonicalMoney(line.sell), cost: canonicalMoney(line.buy) })) };
      const key = await receiptRetryKey(localStorage, scope, payload);
      const response = await fetch("/api/v1/finance/service-vouchers", { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if ([400, 404].includes(response.status)) { clearReceiptRetry(localStorage, scope); throw new Error("Invoice was rejected without posting. Check the billing branch, active supplier, quantities and amounts."); }
      if (!response.ok) throw new Error("Invoice was not confirmed. Preserve its original details and check saved submission before retrying.");
      const result = await response.json();
      if (typeof result.invoiceNumber !== "string") throw new Error("Invoice confirmation is unavailable. Check saved submission.");
      setSaved(result.invoiceNumber); clearReceiptRetry(localStorage, scope); await load();
    } catch (e) { setError(e instanceof Error && /receipt/i.test(e.message) ? "A prior invoice is unconfirmed. Retry its original details or check saved submission." : e instanceof Error ? e.message : "Invoice was not confirmed."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section className="space-y-4"><header><h1>General / quick invoices</h1><p>PKR service invoices with independent buying and selling rates. Quantity multiplies each unit rate. Dates are recorded at UTC midnight.</p></header>
    {error && <p role="alert">{error}</p>}
    <button type="button" className={button} disabled={busy || !!saved} onClick={() => void confirmSaved()}>Check saved submission</button>
    {saved && <div><p role="status">Invoice confirmed: {saved}.</p><button type="button" className={button} onClick={onNew}>Start another invoice</button></div>}
    <form onSubmit={submit}><fieldset className="space-y-4" disabled={busy || !!saved}><legend className="sr-only">Invoice details</legend>
      <div className="grid gap-3 sm:grid-cols-3"><label>Date (UTC)<input className={control} name="date" type="date" required /></label><ReferenceInput field={{ name: "branchId", label: "Branch (default if blank)", type: "String", reference: "branches", required: false, nullable: true }} value="" disabled={busy || !!saved} /><ReferenceInput field={{ name: "customerId", label: "Billing customer", type: "String", reference: "customers", required: true, nullable: false }} value="" disabled={busy || !!saved} /><ReferenceInput field={{ name: "supplierId", label: "Supplier account", type: "String", reference: "suppliers", required: buy > BigInt(0), nullable: true }} value="" disabled={busy || !!saved} /></div>
      {lines.map((line, index) => <fieldset key={line.id} className="grid gap-3 rounded border border-line bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"><legend>Service line {index + 1}</legend><label>Description<input className={control} maxLength={2000} value={line.description} onChange={e => change(line.id, "description", e.target.value)} required /></label><label>Quantity<input className={control} inputMode="numeric" value={line.qty} onChange={e => change(line.id, "qty", e.target.value)} required /></label><label>Unit buying<input className={control} inputMode="decimal" value={line.buy} onChange={e => change(line.id, "buy", e.target.value)} required /></label><label>Unit selling<input className={control} inputMode="decimal" value={line.sell} onChange={e => change(line.id, "sell", e.target.value)} required /></label><button className={button} type="button" disabled={lines.length <= 1} onClick={() => setLines(prior => prior.filter(row => row.id !== line.id))}>Remove service line {index + 1}</button></fieldset>)}
      <button className={button} type="button" disabled={lines.length >= 500} onClick={() => setLines(prior => [...prior, { id: serial.current++, description: "", qty: "1", sell: "", buy: "" }])}>Add service line</button>
      <div className="grid gap-3 sm:grid-cols-3"><label>Tax amount<input className={control} inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} /></label><label>Discount amount<input className={control} inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /></label><label>Notes<textarea className={control} name="notes" maxLength={2000} /></label></div>
      <p aria-live="polite">{valid ? `Buying ${formatted(buy)} · Selling ${formatted(sell)} · Customer total ${formatted(net)} · Difference ${formatted(net - buy)}` : "Complete descriptions and whole-number quantities, using amounts with up to two decimal places."}</p>
      <label className="flex gap-2"><input type="checkbox" name="review" value="yes" required />I reviewed the customer, supplier, quantities and final amounts and authorize posting this invoice.</label><button className={button} disabled={!valid}>Post invoice</button>
    </fieldset></form>
    <section className="space-y-3"><h2>Invoice history</h2>{historyError && <p role="alert">{historyError}</p>}<button className={button} type="button" onClick={() => void load(history?.page || 1)}>Reload invoices</button>{history && <><p>{history.total} invoices · Page {history.page}</p><div className="relative overflow-x-auto rounded border border-line bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Service invoice history</caption><thead><tr>{["Invoice", "Date", "Customer", "Supplier", "Status", "Buying", "Customer total", "Paid", "Action"].map(title => <th key={title} className="p-3">{title}</th>)}</tr></thead><tbody>{history.rows.map(row => <tr key={row.id}>{[row.invoiceNumber, row.date.slice(0,10), row.customer?.fullName || "—", row.supplier?.name || "Not recorded", row.status, canonicalMoney(row.cost), canonicalMoney(row.net), canonicalMoney(row.paid)].map((text, i) => <td key={i} className="border-t border-line p-3">{text}</td>)}<td className="border-t border-line p-3"><button type="button" className={button} disabled={row.status !== "POSTED" || !row.customer || cents(row.net) <= cents(row.paid)} onClick={() => setReceiptInvoice(row)}>Record receipt for {row.invoiceNumber}</button></td></tr>)}</tbody></table></div><nav aria-label="Invoice pagination" className="flex gap-3"><button className={button} disabled={history.page <= 1} onClick={() => void load(history.page - 1)}>Previous</button><button className={button} disabled={history.page * 50 >= history.total} onClick={() => void load(history.page + 1)}>Next</button></nav></>}</section>
    {receiptInvoice && <ServiceInvoiceReceipt key={receiptInvoice.id} invoice={receiptInvoice} username={username} onSaved={() => void load(history?.page || 1)} onClose={() => setReceiptInvoice(null)} />}
  </section>;
}

function ServiceInvoiceReceipt({ invoice, username, onSaved, onClose }: { invoice: Summary; username: string; onSaved: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState("");
  const posting = useRef(false);
  async function recover() {
    setBusy(true); setError("");
    try {
      const key = savedReceiptRetryKey(localStorage, username);
      if (!key) throw new Error("No pending receipt is saved in this browser.");
      const response = await fetch(`/api/v1/finance/receipts/submission/${encodeURIComponent(key)}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Receipt is not confirmed. Preserve and retry its original details.");
      const value = await response.json();
      if (typeof value.receiptNo !== "string") throw new Error("Receipt confirmation is unavailable.");
      setSaved(value.receiptNo); clearReceiptRetry(localStorage, username); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Receipt recovery is unavailable."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (posting.current || busy || saved) return;
    const form = new FormData(event.currentTarget);
    if (form.get("review") !== "yes") return;
    posting.current = true; setBusy(true); setError("");
    try {
      const payload = { serviceInvoiceId: invoice.id, amount: canonicalMoney(String(form.get("amount"))), method: String(form.get("method")), notes: String(form.get("notes") || "") };
      const key = await receiptRetryKey(localStorage, username, payload);
      const response = await fetch("/api/v1/finance/receipts", { method: "POST", cache: "no-store", redirect: "error", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Receipt was not confirmed. Check saved submission and receipt review history before retrying its original details.");
      const value = await response.json();
      if (typeof value.receiptNo !== "string") throw new Error("Receipt confirmation is unavailable. Check saved submission.");
      setSaved(value.receiptNo); clearReceiptRetry(localStorage, username); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Receipt was not confirmed."); } finally { posting.current = false; setBusy(false); }
  }
  return <section aria-label="Invoice receipt" className="space-y-3 rounded border border-line bg-white p-4"><h2>Receipt for {invoice.invoiceNumber}</h2><p>Last loaded outstanding amount: {formatted(cents(invoice.net) - cents(invoice.paid))} PKR. Saved receipts must be reviewed before another payment for the same customer.</p>{error && <p role="alert">{error}</p>}{saved && <div><p role="status">Saved receipt found: {saved}. Review its details and invoice allocation in receipt history.</p><Link className="underline" href={`/admin/manage/receipts?q=${encodeURIComponent(saved)}`}>Review saved receipt</Link></div>}<button type="button" className={button} disabled={busy || !!saved} onClick={() => void recover()}>Check saved receipt submission</button><form onSubmit={submit}><fieldset className="grid gap-3 sm:grid-cols-2" disabled={busy || !!saved}><legend className="sr-only">Receipt details</legend><label>Amount<input className={control} name="amount" inputMode="decimal" required /></label><label>Method<select className={control} name="method" required><option value="">Select method</option><option value="CASH">Cash</option><option value="BANK">Bank</option></select></label><label>Notes<input className={control} name="notes" maxLength={4000} /></label><label className="flex gap-2"><input type="checkbox" name="review" value="yes" required />I reviewed the invoice, received amount and method and authorize this receipt.</label><button className={button}>Record invoice receipt</button></fieldset></form><button type="button" className={button} disabled={busy} onClick={onClose}>Close receipt form</button></section>;
}
