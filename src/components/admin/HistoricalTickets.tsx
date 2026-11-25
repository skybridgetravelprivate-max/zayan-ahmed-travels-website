"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Statement = { sourceHash: string; supplier: string; currency: string; total: string; note: string;
  tickets: { ticketNumber: string; passenger: string; sector: string; invoice: string; invoiceDate: string; amount: string }[] };
type Group = { id: string; pnr: string; version: string; statements: Statement[] };
const endpoint = "/api/v1/management/historical-tickets";
const button = "min-h-11 rounded-lg border border-line px-4 py-2 font-semibold disabled:opacity-50";
const input = "mt-1 w-full rounded-lg border border-line bg-white p-3 text-foreground";

async function request(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? "PATCH" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  if (response.status === 401) throw new Error("Your session expired. Sign in again.");
  if (response.status === 403) throw new Error("These historical records require Super Admin access.");
  if (response.status === 409) throw new Error("Another user changed this group. Reload before saving your note.");
  if (!response.ok) throw new Error(body ? "Save was not confirmed. Reload the group before retrying." : "Historical tickets could not be loaded.");
  return response.json();
}

function GroupReview({ group, statement, reload }: { group: Group; statement: Statement; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(statement.note);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return <div className="mt-4">
    {statement.note && !editing && <p className="whitespace-pre-wrap">Review note: {statement.note}</p>}
    {!editing ? <button className={button} onClick={() => { setEditing(true); setError(""); }}>Edit review note</button> :
      <form onSubmit={async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
        try { await request(`${endpoint}/${encodeURIComponent(group.id)}/review`, { sourceHash: statement.sourceHash, version: group.version, note, reason });
          setMessage("Review note saved. Ticket amounts and accounting are unchanged."); setEditing(false); reload();
        } catch (e) { setError(e instanceof Error ? e.message : "Save unavailable"); } finally { setBusy(false); }
      }}>
        <label className="block">Review note<textarea className={input} value={note} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)} /></label>
        <label className="mt-3 block">Reason for change<input className={input} value={reason} required maxLength={500} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
        <div className="mt-3 flex gap-3"><button className={button} disabled={busy || !reason.trim()}>Save review note</button>
          <button type="button" className={button} disabled={busy} onClick={() => { setEditing(false); setNote(statement.note); setReason(""); }}>Cancel</button></div>
      </form>}
    {message && <p role="status" className="mt-2">{message}</p>}
    {error && <p role="alert" className="mt-2">{error} <button className={button} onClick={reload}>Reload groups</button></p>}
  </div>;
}

export function HistoricalTickets() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    request(endpoint).then(data => { if (active) { setGroups(data.groups); setCursor(data.nextCursor); setError(""); } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const reload = () => { setLoading(true); setRevision(v => v + 1); };
  const query = search.trim().toLowerCase();
  const filtered = groups.filter(g => [g.pnr, ...g.statements.flatMap(s => [s.supplier, ...s.tickets.flatMap(t => [t.passenger, t.ticketNumber, t.invoice, t.sector])])].some(v => v.toLowerCase().includes(query)));
  return <section>
    <Link className="underline" href="/admin/manage/tickets">Issued tickets</Link>
    <h1 className="mt-4 text-3xl font-bold text-zayan-blue">Historical supplier tickets</h1>
    <p className="mt-3">Tickets from supplier statements, grouped by PNR. Amounts are supplier statement charges. Customer selling prices and customer payments are not established by these records.</p>
    <p className="mt-2">Review notes can be edited. Original statement values are preserved; this section does not issue tickets or post financial entries.</p>
    <label className="mt-4 block">Find PNR, passenger, ticket or invoice<input type="search" className={input} value={search} onChange={e => setSearch(e.target.value)} /></label>
    <button className={`${button} mt-3`} disabled={loading} onClick={reload}>Reload groups</button>
    {loading && <p role="status">Loading historical tickets…</p>}
    {error && <p role="alert">{error}</p>}
    {!error && !loading && <p className="mt-3">{groups.length} groups loaded · {groups.reduce((n, g) => n + g.statements.reduce((a, s) => a + s.tickets.length, 0), 0)} ticket rows</p>}
    {!error && filtered.map(group => <article key={group.id} className="mt-6 rounded-xl border border-line p-4">
      <h2 className="text-xl font-semibold">PNR {group.pnr}</h2>
      {group.statements.map(statement => <div key={statement.sourceHash}>
        <p className="mt-2">{statement.supplier} · {statement.currency} {statement.total} · {statement.tickets.length} tickets</p>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Tickets for PNR {group.pnr}</caption>
          <thead><tr>{["Passenger", "Ticket number", "Sector", "Supplier invoice", "Invoice date", "Supplier amount"].map(label => <th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead>
          <tbody>{statement.tickets.map((t, index) => <tr key={`${t.ticketNumber}-${index}`} className="border-t border-line">
            {[t.passenger, t.ticketNumber, t.sector, t.invoice, t.invoiceDate, `${statement.currency} ${t.amount}`].map((v, i) => <td className="p-2" key={i}>{v}</td>)}
          </tr>)}</tbody>
        </table></div>
        <GroupReview key={`${statement.sourceHash}-${group.version}`} group={group} statement={statement} reload={reload} />
      </div>)}
    </article>)}
    {!loading && !error && filtered.length === 0 && <p className="mt-4">No matching historical tickets.</p>}
    {cursor && <button className={`${button} mt-4`} disabled={loading} onClick={async () => {
      setLoading(true); try { const data = await request(`${endpoint}?cursor=${encodeURIComponent(cursor)}`); setGroups(current => [...current, ...data.groups]); setCursor(data.nextCursor); setError(""); }
      catch (e) { setError(e instanceof Error ? e.message : "Load unavailable"); } finally { setLoading(false); }
    }}>Load more groups</button>}
  </section>;
}
