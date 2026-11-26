"use client";
import { useEffect, useState } from "react";

type Balances = Record<"cashBalance" | "bankBalance" | "totalReceivable" | "totalPayable" | "totalSales" | "monthlyProfit", string>;
const labels: Record<keyof Balances, string> = { cashBalance: "Cash in hand", bankBalance: "Bank balance", totalReceivable: "Customer receivables", totalPayable: "Supplier payables", totalSales: "Today's posted revenue", monthlyProfit: "Today's posted profit / loss" };
function amount(value: string) {
  const [whole, cents] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}
export function AccountingBalances() {
  const [balances, setBalances] = useState<Balances | null>(null), [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/dashboard/summary?preset=today", { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (data.basis?.contractVersion !== 2 || data.basis?.currency !== "PKR" || !Object.keys(labels).every(key => typeof data.cards?.[key] === "string" && /^-?\d{1,30}\.\d{2}$/.test(data.cards[key]))) throw new Error();
        if (active) { setBalances(data.cards); setError(false); }
      }).catch(() => { if (active) { setError(true); setBalances(null); } });
    return () => { active = false; };
  }, [revision]);
  return <section className="mt-6" aria-labelledby="accounting-balances">
    <h2 id="accounting-balances">Financial overview</h2>
    <p className="mt-2 text-sm text-muted">PKR · Posted ledger balances across all branches. Today&apos;s movement uses the company calendar and includes reversals.</p>
    {error ? <p role="alert" className="accounting-overview-card mt-3">Financial overview unavailable. <button className="ml-2 underline" onClick={() => setRevision(v => v + 1)}>Retry</button></p> :
      balances ? <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(Object.keys(labels) as (keyof Balances)[]).map(key => <article key={key} className="accounting-overview-card">
        <h3>{labels[key]}</h3><p className="crm-figures mt-3 text-2xl font-semibold">{amount(balances[key])}</p>
      </article>)}</div> : <p role="status" className="mt-3">Loading posted financial balances…</p>}
  </section>;
}
