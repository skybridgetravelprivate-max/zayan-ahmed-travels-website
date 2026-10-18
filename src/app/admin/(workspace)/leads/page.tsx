import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import type { StaffLeadSummary } from "@/lib/staff-leads";
import { fetchStaffLeadPage } from "@/server/staff-leads";

export const metadata: Metadata = {
  title: "Inquiries and leads",
  robots: { index: false, follow: false },
};

type SearchParams = {
  page?: string | string[];
  q?: string | string[];
};

function single(value: string | string[] | undefined) {
  if (value === undefined) return { value: "", invalid: false };
  if (typeof value !== "string") return { value: "", invalid: true };
  return { value, invalid: false };
}

function parsePage(value: string | string[] | undefined) {
  if (value === undefined) return { page: 1, invalid: false };
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) {
    return { page: 1, invalid: true };
  }
  const page = Number(value);
  return page <= 10000 ? { page, invalid: false } : { page: 1, invalid: true };
}

function hrefFor(page: number, query: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("q", query);
  return `/admin/leads?${params.toString()}`;
}

function dateLabel(value: string) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function LeadLink({ lead }: { lead: StaffLeadSummary }) {
  return (
    <Link
      href={`/admin/leads/${encodeURIComponent(lead.id)}`}
      className="font-semibold text-zayan-blue underline decoration-zayan-blue/40 underline-offset-2 hover:decoration-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
    >
      {lead.fullName}
    </Link>
  );
}

export default async function StaffLeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">
          Leads are unavailable
        </h1>
        <p className="mt-3">We could not verify your staff session. Retry the workspace.</p>
        <Link href="/admin/leads" className="mt-4 inline-block underline">Retry</Link>
      </section>
    );
  }
  if (!identity.user.isSuperAdmin && !identity.user.permissions.includes("lead.view")) {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Access denied</h1>
        <p className="mt-3">Your account does not have permission to view leads.</p>
      </section>
    );
  }

  const params = await searchParams;
  const queryParam = single(params.q);
  const pageParam = parsePage(params.page);
  const query = queryParam.value.trim();
  const invalidQuery = queryParam.invalid || query.length > 100;

  if (invalidQuery) {
    return (
      <section>
        <h1 className="text-3xl font-bold text-zayan-blue">Inquiries and leads</h1>
        <SearchForm query="" />
        <p role="alert" className="mt-4 rounded-xl border border-line p-4">
          Search must be a single value of 100 characters or fewer. Adjust the
          search and try again.
        </p>
      </section>
    );
  }

  const result = await fetchStaffLeadPage(
    pageParam.page,
    query,
  );
  if (result.status === "signed-out") redirect("/admin/login");

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">
        CRM
      </p>
      <h1 className="mt-2 text-3xl font-bold text-zayan-blue">
        Inquiries and leads
      </h1>
      <p className="mt-2 text-sm text-muted">
        Read-only lead records returned by your authorized staff access.
      </p>
      <SearchForm query={query} />

      {pageParam.invalid ? (
        <p role="alert" className="mt-4 rounded-xl border border-line p-4">
          The page number was invalid. Showing the first page instead.
        </p>
      ) : null}

      {result.status === "forbidden" ? (
        <p role="alert" className="mt-4 rounded-xl border border-line p-5">
          Access denied. Your account is not authorized to view leads.
        </p>
      ) : result.status === "not-found" ? (
        <p role="alert" className="mt-4 rounded-xl border border-line p-5">
          Lead records could not be found. No records were displayed.
        </p>
      ) : result.status === "unavailable" ? (
        <div role="alert" className="mt-4 rounded-xl border border-line p-5">
          <p>Lead records are temporarily unavailable. No records were displayed.</p>
          <Link href={hrefFor(pageParam.page, query)} className="mt-3 inline-block underline">
            Retry
          </Link>
        </div>
      ) : result.status === "ok" ? (
        <LeadResults
          leads={result.data.data}
          total={result.data.total}
          page={result.data.page}
          pageSize={result.data.pageSize}
          query={query}
        />
      ) : null}
    </section>
  );
}

function SearchForm({ query }: { query: string }) {
  return (
    <form
      action="/admin/leads"
      method="get"
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end"
    >
      <label htmlFor="lead-search" className="min-w-0 flex-1 text-sm font-medium">
        Search leads
        <input
          id="lead-search"
          name="q"
          type="search"
          maxLength={100}
          defaultValue={query}
          placeholder="Name, lead number, contact, or searchable CRM fields"
          className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5"
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-zayan-blue px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange"
      >
        Search
      </button>
    </form>
  );
}

function LeadResults({
  leads,
  total,
  page,
  pageSize,
  query,
}: {
  leads: StaffLeadSummary[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (page > pageCount) {
    return (
      <p role="alert" className="mt-4 rounded-xl border border-line p-4">
        This page is beyond the available results.{" "}
        <Link href={hrefFor(1, query)} className="underline">
          Return to the first page
        </Link>
        .
      </p>
    );
  }

  if (leads.length === 0) {
    return (
      <p role="status" className="mt-6 rounded-2xl border border-line bg-surface p-6 text-muted">
        {query ? "No leads match this search." : "No leads are available to your account."}
      </p>
    );
  }

  return (
    <>
      <p className="mt-5 text-sm text-muted">
        {total} {total === 1 ? "lead" : "leads"} · Page {page} of {pageCount}
      </p>
      <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Authorized inquiries and leads</caption>
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Lead</th>
              <th scope="col" className="px-4 py-3">Contact</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Priority</th>
              <th scope="col" className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-4">
                  <LeadLink lead={lead} />
                  <p className="mt-1 text-xs text-muted">{lead.leadNumber}</p>
                </td>
                <td className="px-4 py-4">
                  <p>{lead.mobile}</p>
                  {lead.email ? <p className="mt-1 text-xs text-muted">{lead.email}</p> : null}
                </td>
                <td className="px-4 py-4">{lead.status}</td>
                <td className="px-4 py-4">{lead.priority || "Unavailable"}</td>
                <td className="px-4 py-4">{dateLabel(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 grid gap-3 md:hidden">
        {leads.map((lead) => (
          <li key={lead.id} className="rounded-2xl border border-line bg-surface p-4">
            <LeadLink lead={lead} />
            <p className="mt-1 text-xs text-muted">{lead.leadNumber}</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Contact</dt><dd className="break-all">{lead.mobile}</dd>
              <dt className="text-muted">Status</dt><dd>{lead.status}</dd>
              <dt className="text-muted">Priority</dt><dd>{lead.priority || "Unavailable"}</dd>
              <dt className="text-muted">Created</dt><dd>{dateLabel(lead.createdAt)}</dd>
            </dl>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav aria-label="Lead pages" className="mt-6 flex justify-between">
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1, query)}
              rel="prev"
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium underline"
            >
              Previous page
            </Link>
          ) : <span />}
          {page < pageCount ? (
            <Link
              href={hrefFor(page + 1, query)}
              rel="next"
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium underline"
            >
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
