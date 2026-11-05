"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type RequestRow = { id: string; kind: string; subject: string; message: string; reply: string | null; status: string; updatedAt: string; agent: { name: string } };
export function AgencyReviewQueue() {
  const [rows, setRows] = useState<RequestRow[]>([]), [notice, setNotice] = useState(""), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [page, setPage] = useState(1), [total, setTotal] = useState(0), [canLinkLead, setCanLinkLead] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/v1/agency-review?page=${page}`, { cache: "no-store", signal: abort.signal }).then(async response => { if (!response.ok) throw Error(); const data = await response.json(); setRows(data.rows); setTotal(data.total); setCanLinkLead(data.canLinkLead === true); }).catch(() => { if (!abort.signal.aborted) setNotice("Agency review is unavailable or your account does not have access."); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [page]);
  async function reply(event: React.FormEvent<HTMLFormElement>, row: RequestRow) {
    event.preventDefault(); if (pending) return; setPending(true); setNotice("");
    try { const response = await fetch(`/api/v1/agency-review/${row.id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicReply: new FormData(event.currentTarget).get("reply"), version: row.updatedAt }) }); if (!response.ok) throw Error(); const data = await response.json(); setNotice(data.notice); const latest = await fetch(`/api/v1/agency-review?page=${page}`, { cache: "no-store" }); if (!latest.ok) throw Error(); setRows((await latest.json()).rows); }
    catch { setNotice("Reply could not be confirmed. Reload and review the current request before trying again."); }
    finally { setPending(false); }
  }
  async function linkLead(event: React.FormEvent<HTMLFormElement>, row: RequestRow) {
    event.preventDefault();
    if (pending) return;
    const leadReference = String(new FormData(event.currentTarget).get("leadReference")).trim();
    setPending(true);
    try {
      const response = await fetch(`/api/v1/agency-review/${row.id}/lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadReference }) });
      if (!response.ok) throw new Error("Link unavailable");
      setNotice((await response.json()).notice);
    } catch { setNotice("Lead link could not be confirmed. Review the existing lead, agency and branch before retrying."); }
    finally { setPending(false); }
  }
  return <section><h1 className="text-3xl font-bold text-zayan-blue">Agency requests</h1><p className="my-4">Review enquiries and servicing requests within your assigned branches. Replies are visible to the agency. Use established booking and finance workflows for execution.</p>{loading && <p role="status">Loading requests…</p>}{notice && <p role="status" className="my-4 rounded-lg bg-sky-50 p-4">{notice}</p>}<div className="space-y-5">{rows.map(row => <article key={row.id} className="rounded-xl border border-line bg-white p-5"><h2 className="text-xl font-bold">{row.subject}</h2><p className="mt-2 text-sm">{row.agent.name} · {row.kind} · {row.status}</p><p className="my-4 whitespace-pre-wrap break-words">{row.message}</p><form onSubmit={event => reply(event, row)}><label className="block font-semibold">Public reply<textarea name="reply" key={row.updatedAt} defaultValue={row.reply || ""} required maxLength={4000} className="mt-2 block min-h-28 w-full rounded-lg border p-3" /></label><button disabled={pending} className="mt-3 rounded-lg bg-zayan-blue px-5 py-3 font-bold text-white">Save public reply</button></form>{canLinkLead && <form onSubmit={event => linkLead(event, row)} className="mt-5 border-t pt-4"><p className="mb-3 text-sm">Create or review the agency-assigned lead in the <Link href="/admin/leads" className="underline">lead workspace</Link>, then link its reference here. The lead must belong to this agency and branch.</p><label className="block font-semibold">Existing lead reference<input name="leadReference" required maxLength={80} className="mt-2 block w-full rounded-lg border p-3" /></label><button disabled={pending} className="mt-3 min-h-11 rounded-lg border px-5 py-3">Link existing lead</button></form>}</article>)}</div>{!loading && !rows.length && <p>No agency requests to show.</p>}<div className="mt-5 flex items-center gap-5"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Previous</button><span>Page {page} · {total} requests</span><button disabled={page * 30 >= total} onClick={() => setPage(page + 1)} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Next</button></div></section>;
}
