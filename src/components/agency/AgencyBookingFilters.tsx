"use client";

import { useState } from "react";

export function AgencyBookingFilters({ query, onApply }: { query: string; onApply: (query: string) => void }) {
  const current = new URLSearchParams(query);
  const [error, setError] = useState("");
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const name of ["q", "service", "status", "from", "to"]) {
      const value = String(fields.get(name) || "").trim();
      if (value) params.set(name, value);
    }
    if (params.get("from") && params.get("to") && params.get("from")! > params.get("to")!) {
      setError("Created-to must be on or after created-from.");
      return;
    }
    setError("");
    onApply(params.toString());
  }
  return <form onSubmit={apply} className="my-5 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
    <label>Booking reference<input name="q" defaultValue={current.get("q") || ""} maxLength={80} className="mt-2 block w-full rounded-lg border p-3" /></label>
    <label>Service<select name="service" defaultValue={current.get("service") || ""} className="mt-2 block w-full rounded-lg border p-3"><option value="">All services</option><option value="umrah">Umrah</option><option value="hotels">Hotels</option><option value="tickets">Ticket records</option></select></label>
    <label>Status<select name="status" defaultValue={current.get("status") || ""} className="mt-2 block w-full rounded-lg border p-3"><option value="">All statuses</option>{["DRAFT", "QUOTED", "CONFIRMED", "PROCESSING", "READY", "TRAVELING", "COMPLETED", "CANCELLED", "TENTATIVE", "DEFINITE", "BOOKED", "ISSUED", "REFUNDED", "REISSUED"].map(status => <option key={status}>{status}</option>)}</select></label>
    <label>Created from<input type="date" name="from" defaultValue={current.get("from") || ""} className="mt-2 block w-full rounded-lg border p-3" /></label>
    <label>Created to<input type="date" name="to" defaultValue={current.get("to") || ""} className="mt-2 block w-full rounded-lg border p-3" /></label>
    <div className="self-end"><button className="min-h-11 rounded-lg bg-zayan-blue px-5 py-3 font-bold text-white">Apply booking filters</button></div>
    <p className="text-sm text-muted sm:col-span-2">Dates filter record creation in UTC. Travel and check-in dates appear on each record. A ticket record status requires separate supplier verification.</p>
    {error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
  </form>;
}
