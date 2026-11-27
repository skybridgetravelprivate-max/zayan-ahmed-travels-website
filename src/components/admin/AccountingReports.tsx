"use client";

import { useEffect, useState, type FormEvent } from "react";

type Report = { key: string; label: string; group: string };
type Result = { rows: Record<string, unknown>[]; total: number; page: number; pageSize: number };
const control = "rounded border border-line bg-white px-3 py-2";
const dated = (key: string) => !["receivables", "receivables-summary"].includes(key);
const cell = (value: unknown) => value === null || value === undefined ? "—" : ["string", "number", "boolean"].includes(typeof value) ? String(value) : "—";

async function read(path: string) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again." : response.status === 403 ? "Global reports require Super Admin access." : "The report could not be loaded. Retry or narrow the filters.");
  return response.json();
}

export function AccountingReports() {
  const [catalog, setCatalog] = useState<Report[]>([]);
  const [selected, setSelected] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ key: string; query: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    read("/api/v1/reports/catalog").then(data => {
      if (!Array.isArray(data) || data.some(r => !r || typeof r.key !== "string" || !/^[a-z0-9-]+$/.test(r.key) || typeof r.label !== "string" || typeof r.group !== "string")) throw new Error("Report catalogue is unavailable.");
      if (active) { setCatalog(data); setSelected(data[0]?.key || ""); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Report catalogue is unavailable."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function run(key: string, query: string, page = 1) {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await read(`/api/v1/reports/run/${encodeURIComponent(key)}?${query}&page=${page}&pageSize=50`);
      if (!data || !Array.isArray(data.rows) || data.rows.some((r: unknown) => !r || typeof r !== "object" || Array.isArray(r)) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page || data.pageSize !== 50) throw new Error("The report response could not be verified.");
      setResult(data); setApplied({ key, query });
    } catch (e) { setError(e instanceof Error ? e.message : "The report could not be loaded."); }
    finally { setLoading(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!catalog.some(r => r.key === selected)) return;
    if (dated(selected) && selected !== "trial-balance" && from && to && from > to) { setError("Start date must not follow end date."); return; }
    const query = new URLSearchParams();
    if (dated(selected)) { if (from && selected !== "trial-balance") query.set("from", from); if (to) query.set("to", to); }
    void run(selected, query.toString());
  }

  const columns = result ? [...new Set(result.rows.flatMap(row => Object.keys(row)))] : [];
  const activeReport = catalog.find(r => r.key === applied?.key);
  return <section className="space-y-4">
    <header><h1>Reports</h1><p className="text-muted">Posted accounting and service reports across all branches. Super Admin access only.</p></header>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded border border-line bg-white p-4">
      <label className="grid gap-1">Report<select className={control} value={selected} onChange={e => setSelected(e.target.value)} disabled={loading || !catalog.length}>{[...new Set(catalog.map(r => r.group))].map(group => <optgroup key={group} label={group}>{catalog.filter(r => r.group === group).map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</optgroup>)}</select></label>
      {dated(selected) && <>{selected !== "trial-balance" && <label className="grid gap-1">From<input type="date" className={control} value={from} onChange={e => setFrom(e.target.value)} /></label>}<label className="grid gap-1">{selected === "trial-balance" ? "As of (UTC midnight)" : "To"}<input type="date" className={control} value={to} onChange={e => setTo(e.target.value)} /></label></>}
      <button className={control} disabled={loading || !selected}>Run report</button>
    </form>
    {!dated(selected) && <p>Receivables show the current outstanding position; date filters do not apply.</p>}
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading report…</p>}
    {result && applied && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2>{activeReport?.label || "Report"}</h2><a className={`${control} underline`} href={`/api/v1/reports/run/${encodeURIComponent(applied.key)}?${applied.query}&format=csv`}>Export CSV</a></div>
      <p>{result.total} rows · Page {result.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))}. Values use the report&apos;s existing accounting basis.</p>
      {!result.rows.length ? <p>No records match this report.</p> : <div className="relative overflow-x-auto rounded border border-line bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">{activeReport?.label || "Report results"}</caption><thead><tr>{columns.map(key => <th className="border-b border-line p-3" key={key}>{key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ")}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{columns.map(key => <td className="border-b border-line p-3" key={key}>{cell(row[key])}</td>)}</tr>)}</tbody></table></div>}
      <nav aria-label="Report pagination" className="flex gap-3"><button className={control} disabled={loading || result.page <= 1} onClick={() => void run(applied.key, applied.query, result.page - 1)}>Previous</button><button className={control} disabled={loading || result.page * result.pageSize >= result.total} onClick={() => void run(applied.key, applied.query, result.page + 1)}>Next</button></nav>
    </div>}
  </section>;
}
