import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getStaffIdentity,
  getStaffModules,
  staffRequest,
} from "@/server/staff-api";
import { CrmWorkQueue } from "@/components/admin/CrmWorkQueue";
import { moduleHref, moduleCapabilities } from "@/lib/staff-navigation";
export const metadata: Metadata = {
  title: "Staff dashboard",
  robots: { index: false, follow: false },
};
type Summary = {
  generatedAt: string;
  timeZone: string;
  scope: string;
  period: { start: string; endExclusive: string };
  metrics: {
    key: string;
    label: string;
    value: number | null;
    basis: string;
  }[];
};
export default async function StaffDashboard() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated")
    return (
      <section role="alert">
        <h1 className="text-2xl font-bold">Staff workspace unavailable</h1>
        <p className="mt-3">We could not verify your session.</p>
        <Link href="/admin" className="underline">
          Retry
        </Link>
      </section>
    );
  const { user } = identity;
  let modules: Awaited<ReturnType<typeof getStaffModules>> | null = null,
    summary: Summary | null = null;
  try {
    modules = await getStaffModules();
  } catch {
    /* Unavailable is not an empty catalogue. */
  }
  const canViewSummary =
    user.isSuperAdmin || user.permissions.includes("dashboard.view");
  if (canViewSummary)
    try {
      const response = await staffRequest("/api/v1/dashboard/workspace");
      if (response?.ok) {
        const value = await response.json();
        if (
          typeof value.timeZone === "string" &&
          typeof value.scope === "string" &&
          value.period?.start &&
          Array.isArray(value.metrics)
        )
          summary = value;
      }
    } catch {
      /* Preserve an honest unavailable state. */
    }
  const date = summary
    ? new Intl.DateTimeFormat("en-PK", {
        timeZone: summary.timeZone,
        dateStyle: "medium",
      })
    : null;
  const quick = modules?.filter((module) =>
    [
      "leads",
      "customers",
      "quotations",
      "tasks",
      "follow-ups",
      "hotel-bookings",
      "tickets",
      "transport-bookings",
    ].includes(module.key),
  );
  return (
    <section>
      <header className="rounded-2xl border border-line bg-slate-50 p-5 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">
          Your work today
        </p>
        <h1 className="mt-2 text-crm-title font-bold text-zayan-blue lg:text-crm-title-lg">
          Welcome, {user.fullName}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Open your permitted work, review priorities and continue customer
          journeys.
        </p>
      </header>
      {canViewSummary && (
        <section aria-labelledby="operational-summary" className="mt-6">
          <h2
            id="operational-summary"
            className="text-xl font-semibold text-zayan-blue"
          >
            Operational overview
          </h2>
          {summary ? (
            <>
              <p className="mt-2 text-sm text-muted">
                {summary.scope} · Company time: {summary.timeZone}. Month to
                date: {date!.format(new Date(summary.period.start))} to{" "}
                {date!.format(new Date(summary.generatedAt))}. These are
                operational counts, not financial statements.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summary.metrics
                  .filter((metric) => metric.value !== null)
                  .map((metric) => (
                    <article
                      key={metric.key}
                      className="rounded-xl border border-line bg-surface p-4"
                    >
                      <h3 className="text-crm-label font-semibold text-zayan-blue">
                        {metric.label}
                      </h3>
                      <p className="crm-figures mt-2 font-crm-data text-crm-balance font-bold">
                        {Number.isSafeInteger(metric.value)
                          ? metric.value
                          : "Unavailable"}
                      </p>
                      <p className="mt-2 text-crm-meta text-crm-muted">{metric.basis}</p>
                    </article>
                  ))}
              </div>
            </>
          ) : (
            <p role="status" className="mt-3 rounded-xl border border-line p-4">
              Summary is temporarily unavailable.{" "}
              <Link href="/admin" className="underline">
                Reload to retry
              </Link>
              .
            </p>
          )}
        </section>
      )}
      <section aria-labelledby="quick-work" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="quick-work" className="text-xl font-semibold text-zayan-blue">
            Your workspace
          </h2>
          <Link
            href="/admin/manage"
            className="min-h-11 rounded-lg border border-line px-4 py-3 text-sm font-semibold"
          >
            All modules
          </Link>
        </div>
        {modules === null ? (
          <p role="status" className="mt-3">
            Your module list is unavailable. Reload to retry.
          </p>
        ) : !modules.length ? (
          <p className="mt-3">
            No modules are assigned to this account. Contact your administrator.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(quick?.length ? quick : modules.slice(0, 6)).map((module) => (
              <Link
                prefetch={false}
                key={module.key}
                href={moduleHref(module.key)}
                className="rounded-xl border border-line bg-surface p-4 hover:border-zayan-blue"
              >
                <span className="font-semibold text-zayan-blue">
                  {module.title}
                </span>
                <span className="mt-2 block text-sm text-muted">
                  {moduleCapabilities(
                    module,
                    user.permissions,
                    user.isSuperAdmin,
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
      {(user.isSuperAdmin || user.permissions.includes("lead.view")) && (
        <CrmWorkQueue />
      )}
      <footer className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5 text-sm text-muted">
        <span>Signed in as {user.username}</span>
        <Link href="/" className="min-h-11 py-3 underline">
          View public website
        </Link>
      </footer>
    </section>
  );
}
