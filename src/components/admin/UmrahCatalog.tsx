"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Rate = { id: string; roomType: string; price: string; childPrice: string; infantPrice: string; status: string; isPublic: boolean };
type Hotel = { name: string; distance: string | null } | null;
type Offer = { code: string; nights: number; makkahNights: number; madinahNights: number; makkahHotel: Hotel; madinahHotel: Hotel; rates: Rate[] };
type Group = { id: string; sector: string; airline: string; travelLabel: string; flights: string[]; sourceSeats: number | null; capturedAt: string | null; offers: Offer[] };
type Catalog = { groups: Group[]; canEdit: boolean; canCreate: boolean; truncated: boolean };
const inputClass = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
const linkClass = "inline-block rounded-lg border border-line px-3 py-2 font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
const money = (value: string) => `PKR ${Number(value).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const minimum = (group: Group) => Math.min(...group.offers.flatMap(o => o.rates.map(r => Number(r.price))));
const roomOrder = ["SHARING", "QUAD", "TRIPLE", "DOUBLE"];
function travelOrder(label: string) {
  const match = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.exec(label);
  return match ? "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ").indexOf(match[2]) * 31 + Number(match[1]) : 999;
}

export function UmrahCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [nights, setNights] = useState("");
  const [sort, setSort] = useState("travel");
  useEffect(() => {
    let active = true;
    fetch("/api/v1/management/umrah/catalog", { credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? "Your staff session expired. Sign in again." : response.status === 403 ? "Your account cannot view Umrah packages." : "Packages could not be loaded.");
      const data = await response.json();
      if (!Array.isArray(data.groups)) throw new Error("Invalid package response.");
      if (active) setCatalog(data);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Packages unavailable"); });
    return () => { active = false; };
  }, []);
  const filtered = (catalog?.groups ?? []).map(group => ({ ...group, offers: group.offers.filter(offer => (!nights || offer.nights === Number(nights)) && `${group.id} ${group.sector} ${group.airline} ${group.travelLabel} ${group.flights.join(" ")} ${offer.code} ${offer.makkahHotel?.name} ${offer.madinahHotel?.name}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(g => g.offers.length);
  filtered.sort((a, b) => sort === "price-low" ? minimum(a) - minimum(b) : sort === "price-high" ? minimum(b) - minimum(a) : travelOrder(a.travelLabel) - travelOrder(b.travelLabel));
  const durations = [...new Set(catalog?.groups.flatMap(g => g.offers.map(o => o.nights)) ?? [])].sort((a, b) => a - b);
  return <section>
    <Link href="/admin/manage" className="text-sm underline">All management modules</Link>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold text-zayan-blue">Umrah flight groups & packages</h1><div className="flex flex-wrap gap-2 print:hidden"><Link className={linkClass} href="/admin/manage/umrah-packages">Manage package records</Link><button type="button" className={linkClass} onClick={() => window.print()}>Print / Save PDF</button></div></div>
    <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">Imported ISB–JED offers are private review drafts. Prices and source seat counts are snapshots, not live availability or inventory allocated to you. Confirm dates including year, costs, inclusions and availability before activation. No booking is made from this page.</p>
    {error && <p role="alert" className="mt-4">{error} <Link href="/admin/login" className="underline">Staff sign in</Link></p>}
    {!catalog && !error && <p role="status" className="mt-5">Loading packages…</p>}
    {catalog && <><div className="mt-5 grid gap-3 sm:grid-cols-3 print:hidden"><label className="font-medium">Search groups, flights or hotels<input className={inputClass} type="search" value={query} onChange={e => setQuery(e.target.value)} maxLength={100} /></label><label className="font-medium">Duration<select className={inputClass} value={nights} onChange={e => setNights(e.target.value)}><option value="">All nights</option>{durations.map(n => <option key={n} value={n}>{n} nights</option>)}</select></label><label className="font-medium">Sort by<select className={inputClass} value={sort} onChange={e => setSort(e.target.value)}><option value="travel">Travel date (month/day)</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
      <p role="status" className="my-4 text-muted">{filtered.length} flight groups · {filtered.reduce((n, g) => n + g.offers.length, 0)} packages · {filtered.reduce((n, g) => n + g.offers.reduce((r, o) => r + o.rates.length, 0), 0)} room options</p>
      {catalog.truncated && <p role="alert">The first 1,000 room options are shown. Use Manage package records to search the complete catalog.</p>}
      {!filtered.length && <p>No packages match these filters.</p>}
      <div className="space-y-5">{filtered.map(group => <article key={group.id} className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-zayan-blue">{group.sector} · {group.id}</p><h2 className="mt-1 text-xl font-bold">{group.airline || "Umrah package"} · {group.travelLabel}</h2><ul className="mt-2 space-y-1 text-sm">{group.flights.map((flight, i) => <li key={i} className="break-words">{flight}</li>)}</ul></div><div><p className="font-bold text-zayan-blue">From {money(String(minimum(group)))}</p>{group.sourceSeats !== null && <p className="mt-1 text-sm">Source snapshot: {group.sourceSeats} seats</p>}<p className="mt-1 text-xs text-muted">{group.capturedAt ? `Captured ${group.capturedAt.slice(0, 10)} · reconfirm with supplier` : "Confirm availability before sale"}</p></div></div>
        <details className="mt-4"><summary className="cursor-pointer rounded-lg border border-line px-3 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue">Package details ({group.offers.length})</summary><div className="mt-4 space-y-5">{group.offers.map(offer => <section key={offer.code} className="rounded-xl border border-line p-4"><h3 className="font-bold">{offer.code} · {offer.nights} nights</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-zayan-blue/5 p-3"><h4 className="font-semibold">Makkah · {offer.makkahNights} nights</h4><p>{offer.makkahHotel?.name || "Hotel not confirmed"}</p><p className="text-sm text-muted">{offer.makkahHotel?.distance}</p></div><div className="rounded-lg bg-zayan-blue/5 p-3"><h4 className="font-semibold">Madinah · {offer.madinahNights} nights</h4><p>{offer.madinahHotel?.name || "Hotel not confirmed"}</p><p className="text-sm text-muted">{offer.madinahHotel?.distance}</p></div></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[...offer.rates].sort((a, b) => roomOrder.indexOf(a.roomType) - roomOrder.indexOf(b.roomType)).map(rate => <div key={rate.id} className="min-w-0 rounded-lg border border-line p-3"><h4 className="font-semibold">{rate.roomType.replaceAll("_", " ")}</h4><p className="mt-2 font-bold text-zayan-blue">{money(rate.price)}</p><p className="mt-2 text-xs">Child without bed: {money(rate.childPrice)}</p><p className="mt-1 text-xs">Infant: {money(rate.infantPrice)}</p><p className="mt-2 break-words text-xs text-muted">{rate.status} · {rate.isPublic ? "Published" : "Private"}</p><Link className={`${linkClass} mt-3 text-sm print:hidden`} href={`/admin/manage/umrah-packages?record=${encodeURIComponent(rate.id)}`}>{catalog.canEdit ? "Review / edit" : "View record"}</Link></div>)}</div>
        </section>)}</div></details>
      </article>)}</div>
    </>}
  </section>;
}
