"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { humanLabel } from "@/lib/staff-management";
import { moduleHref } from "@/lib/staff-navigation";
type Row = Record<string, unknown>;
export function CrmRelatedWork({
  resource,
  id,
  revision,
  permissions,
  isSuperAdmin,
  timeZone,
}: {
  resource: string;
  id: string;
  revision: number;
  permissions: string[];
  isSuperAdmin: boolean;
  timeZone: string;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/v1/crm/${resource}/${encodeURIComponent(id)}/workspace?preview=true`,
      { cache: "no-store", signal: abort.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((value) => {
        if (!abort.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [resource, id, revision]);
  if (error)
    return (
      <section role="status" className="mt-5 rounded-xl border border-line p-4">
        Related work could not be loaded. Reload this record to retry.
      </section>
    );
  if (!data)
    return (
      <p role="status" className="mt-5">
        Loading related work…
      </p>
    );
  const owner = (resource === "leads" ? data.lead : data.customer) as
    | Row
    | undefined;
  if (!owner) return null;
  const groups = [
    ["followUps", "Follow-ups", "follow-ups", "followup.view"],
    ["tasks", "Tasks", "tasks", "task.view"],
    ["quotations", "Quotations", "quotations", "quotation.view"],
    ["customers", "Linked customers", "customers", "customer.view"],
    ["passengers", "Passengers", "passengers", "passenger.view"],
    ["umrahBookings", "Umrah bookings", "umrah-bookings", "booking.view"],
    ["hotelBookings", "Hotel reservations", "hotel-bookings", "hotel.view"],
    ["tickets", "Tickets", "tickets", "ticket.view"],
    ["receipts", "Receipts", "receipts", "account.view"],
  ].filter((group) => isSuperAdmin || permissions.includes(group[3]));
  return (
    <section className="mt-6" aria-labelledby="related-work-title">
      <h2
        id="related-work-title"
        className="text-xl font-semibold text-zayan-blue"
      >
        Related work & recorded activity
      </h2>
      <p className="mt-2 text-sm text-muted">
        Up to 20 records per section. Recorded messages and quotation status do
        not prove delivery. Open a module for all authorized records.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {groups.map(([key, label, target]) => {
          const records = (
            Array.isArray(owner[key])
              ? owner[key]
              : Array.isArray(data[key])
                ? data[key]
                : key === "umrahBookings" && Array.isArray(data.bookings)
                  ? data.bookings
                  : []
          ) as Row[];
          if (!records.length) return null;
          return (
            <section
              key={key}
              className="min-w-0 rounded-xl border border-line p-4"
            >
              <h3 className="font-semibold">{label}</h3>
              <ul className="mt-2 space-y-2">
                {records
                  .slice(0, 20)
                  .filter(
                    (row) =>
                      typeof row.id === "string" &&
                      /^[A-Za-z0-9_-]{1,80}$/.test(row.id),
                  )
                  .map((row) => (
                    <li key={String(row.id)} className="break-words text-sm">
                      <Link
                        prefetch={false}
                        className="inline-block min-h-11 py-3 underline"
                        href={`${moduleHref(target)}?record=${encodeURIComponent(String(row.id))}`}
                      >
                        {String(
                          row.fullName ||
                            row.subject ||
                            row.title ||
                            row.quotationNumber ||
                            row.bookingNumber ||
                            row.ticketNumber ||
                            row.receiptNo ||
                            "Open record",
                        )}
                      </Link>
                      {typeof row.status === "string" && (
                        <span className="ml-2 text-muted">
                          {humanLabel(row.status)}
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          );
        })}
      </div>
      {resource === "leads" && (
        <details className="mt-3 rounded-xl border border-line p-4" open>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">
            Recorded lead activity
          </summary>
          <p className="mb-3 text-xs text-muted">
            Notes, communications and follow-ups only; this is not a complete
            audit history.
          </p>
          <ol className="space-y-3">
            {(Array.isArray(data.timeline) ? data.timeline : [])
              .slice(0, 20)
              .map((entry: Row, index: number) => (
                <li
                  key={index}
                  className="break-words border-t border-line pt-3 text-sm"
                >
                  <p className="font-medium">
                    {typeof entry.title === "string"
                      ? entry.title
                      : "Recorded activity"}
                  </p>
                  {typeof entry.at === "string" &&
                    !Number.isNaN(Date.parse(entry.at)) && (
                      <p className="mt-1 text-xs text-muted">
                        {new Intl.DateTimeFormat("en-PK", {
                          timeZone,
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(entry.at))}{" "}
                        ·{" "}
                        {typeof entry.kind === "string"
                          ? humanLabel(entry.kind)
                          : "Activity"}
                      </p>
                    )}
                  <p className="mt-1 whitespace-pre-wrap">
                    {typeof entry.body === "string" ? entry.body : ""}
                  </p>
                </li>
              ))}
          </ol>
          {Array.isArray(data.timeline) && !data.timeline.length && (
            <p className="text-sm text-muted">No recorded activity.</p>
          )}
        </details>
      )}
    </section>
  );
}
