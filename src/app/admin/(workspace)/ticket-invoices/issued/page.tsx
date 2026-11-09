import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgencyMasthead } from "@/components/admin/AgencyMasthead";
import { bookingDocumentUrl } from "@/lib/booking-presentation";
import { getStaffIdentity, staffRequest } from "@/server/staff-api";
import { ClearInvoiceFilters } from "./ClearInvoiceFilters";

export const metadata: Metadata = { title: "Issued Ticket Invoices", robots: { index: false, follow: false } };

const path = "/admin/ticket-invoices/issued";
const fields = [
  { name: "reference", label: "Ticket number" },
  { name: "passenger", label: "Passenger" },
  { name: "customer", label: "Customer" },
  { name: "supplier", label: "Supplier" },
];
const statuses = { ISSUED: "Issued", REFUNDED: "Refunded", REISSUED: "Reissued" } as const;
const columns = ["Ticket number", "Record created", "Passenger", "Route", "Departure date", "Customer", "Supplier", "Total", "Status", "Actions"];
const control = "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2";
const button = "inline-block rounded-lg border border-line px-3 py-2 text-sm font-medium hover:border-zayan-blue";
const date = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" });

type Ticket = {
  id: string;
  ticketNumber: string | null;
  createdAt: string;
  sector: string | null;
  departureAt: string | null;
  net: string;
  currency: string;
  status: keyof typeof statuses;
  passenger: { fullName: string } | null;
  customer: { fullName: string } | null;
  supplier: { name: string } | null;
};

type TicketList = { data: Ticket[]; total: number; page: number; pageSize: number };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableText(value: unknown) {
  return value === null || typeof value === "string";
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function relation(value: unknown, label: string) {
  return value === null || (record(value) && typeof value[label] === "string");
}

function isTicketList(value: unknown): value is TicketList {
  return record(value) && typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0 &&
    typeof value.page === "number" && Number.isSafeInteger(value.page) && value.page > 0 && value.page <= 10000 &&
    typeof value.pageSize === "number" && Number.isSafeInteger(value.pageSize) && value.pageSize > 0 &&
    Array.isArray(value.data) && value.data.every(ticket =>
      record(ticket) && typeof ticket.id === "string" && ticket.id.length > 0 &&
      nullableText(ticket.ticketNumber) && nullableText(ticket.sector) && validDate(ticket.createdAt) &&
      (ticket.departureAt === null || validDate(ticket.departureAt)) &&
      typeof ticket.net === "string" && typeof ticket.currency === "string" &&
      typeof ticket.status === "string" && Object.hasOwn(statuses, ticket.status) &&
      relation(ticket.passenger, "fullName") && relation(ticket.customer, "fullName") && relation(ticket.supplier, "name"));
}

export default async function IssuedTicketInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  const { user } = identity;
  const can = (permission: string) => user.isSuperAdmin || user.permissions.includes(permission);
  if (!can("ticket.view")) return <p role="alert">Your account does not have permission to view ticket invoices.</p>;

  const input = await searchParams;
  const query = new URLSearchParams();
  for (const { name } of fields) {
    const value = input[name];
    if (typeof value === "string" && value.trim()) query.set(name, value.trim().slice(0, 100));
  }
  if (typeof input.status === "string" && Object.hasOwn(statuses, input.status)) query.set("status", input.status);
  const hasFilters = fields.some(({ name }) => query.has(name)) || (query.get("status") ?? "ISSUED") !== "ISSUED";
  const page = typeof input.page === "string" ? Number(input.page) : 1;
  if (Number.isSafeInteger(page) && page > 1 && page <= 10000) query.set("page", String(page));

  function pageUrl(page: number) {
    const next = new URLSearchParams(query);
    next.delete("page");
    if (page > 1) next.set("page", String(page));
    return next.size ? `${path}?${next}` : path;
  }

  let list: TicketList | null = null;
  try {
    const response = await staffRequest(`/api/v1/management/issued-ticket-invoices?${query}`);
    if (response?.ok) {
      const data: unknown = await response.json();
      if (isTicketList(data)) list = data;
    }
  } catch {
    // The filters remain available when the ticket service is unavailable.
  }

  const lastPage = list ? Math.min(10000, Math.max(1, Math.ceil(list.total / list.pageSize))) : 1;
  const outOfRange = list !== null && list.page > lastPage;

  return (
    <section>
      <AgencyMasthead />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-zayan-blue">Issued Ticket Invoices</h1>
        {can("ticket.create") && <Link className={`${button} bg-zayan-blue text-white`} href="/admin/manage/tickets?action=issue">Create Invoice</Link>}
      </div>
      <p className="mt-2 text-sm text-muted">Search ticket sales and open their invoice PDFs. Dates are shown in Pakistan time.</p>
      <Form key={query.toString()} action={path} className="mt-5 rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {fields.map(({ name, label }) => (
            <label key={name} className="text-sm font-medium">
              {label}
              <input name={name} type="search" maxLength={100} defaultValue={query.get(name) ?? ""} className={control} />
            </label>
          ))}
          <label className="text-sm font-medium">
            Status
            <select name="status" defaultValue={query.get("status") ?? "ISSUED"} className={control}>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={button}>Search</button>
          <ClearInvoiceFilters className={button} href={path} />
        </div>
      </Form>
      {!list ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-300 p-4">
          Ticket invoices could not be loaded. <a className="underline" href={pageUrl(Number(query.get("page") ?? 1))}>Retry</a>
        </p>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted">{list.total} records{!outOfRange && ` · Page ${list.page} of ${lastPage}`}</p>
          {outOfRange ? (
            <p role="status" className="mt-4 rounded-xl border border-line bg-surface p-4">
              There are no invoices on this page. <Link className="underline" href={pageUrl(lastPage)}>Go to page {lastPage}</Link>
            </p>
          ) : !list.data.length ? (
            <p role="status" className="mt-4 rounded-xl border border-line bg-surface p-4">
              {list.total > 0
                ? "There are no invoices on this page. Refresh to see the latest results."
                : hasFilters
                  ? "No ticket invoices match your search. Clear Filters to start again."
                  : "No issued ticket invoices yet. Invoices appear here after a ticket is issued."}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Ticket invoices</caption>
                <thead className="bg-zayan-blue/5">
                  <tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-3 py-3">{column}</th>)}</tr>
                </thead>
                <tbody>
                  {list.data.map(ticket => {
                    const pdf = can("document.view") ? bookingDocumentUrl("tickets", ticket.id, true) : null;
                    return (
                      <tr key={ticket.id} className="border-t border-line align-top [&>td]:px-3 [&>td]:py-3">
                        <td><Link className="font-medium text-zayan-blue underline" href={`/admin/manage/tickets?record=${encodeURIComponent(ticket.id)}`}>{ticket.ticketNumber || "View ticket"}</Link></td>
                        <td className="whitespace-nowrap">{date.format(new Date(ticket.createdAt))}</td>
                        <td>{ticket.passenger?.fullName || "—"}</td>
                        <td>{ticket.sector || "—"}</td>
                        <td className="whitespace-nowrap">{ticket.departureAt ? date.format(new Date(ticket.departureAt)) : "—"}</td>
                        <td>{ticket.customer?.fullName || "—"}</td>
                        <td>{ticket.supplier?.name || "—"}</td>
                        <td className="whitespace-nowrap">{ticket.currency} {ticket.net}</td>
                        <td>{statuses[ticket.status]}</td>
                        <td>{pdf ? (
                          <div className="whitespace-nowrap">
                            <a className="text-zayan-blue underline" href={pdf} target="_blank" rel="noopener noreferrer">View Invoice</a>
                            <p className="mt-1 text-xs text-muted">Print from the PDF viewer</p>
                          </div>
                        ) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Ticket invoice pagination" className="mt-5 flex gap-3">
            {!outOfRange && list.page > 1 && <Link className={button} href={pageUrl(list.page - 1)}>Previous</Link>}
            {!outOfRange && list.page < lastPage && <Link className={button} href={pageUrl(list.page + 1)}>Next</Link>}
          </nav>
        </>
      )}
    </section>
  );
}
