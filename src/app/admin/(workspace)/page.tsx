import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getStaffIdentity,
  getStaffModules,
  staffRequest,
} from "@/server/staff-api";
import { moduleHref, moduleCapabilities } from "@/lib/staff-navigation";
import { accountingModules, accountingQuickKeys } from "@/lib/accounting-workspace";
import { AccountingBalances } from "@/components/admin/AccountingBalances";
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
    modules = accountingModules(await getStaffModules());
  } catch {
    /* Unavailable is not an empty catalogue. */
  }
  const canViewSummary =
    user.isSuperAdmin || user.permissions.includes("dashboard.view");
  if (canViewSummary)
    try {
      const response = await staffRequest("/api/v1/dashboard/operations");
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
    accountingQuickKeys.includes(module.key),
  );
  return (
    <section>
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="uppercase">Overview</h1>
        <p className="text-sm text-muted">Zayan Ahmed Travels / Accounts</p>
      </header>
      {canViewSummary && (
        <section aria-labelledby="operational-summary" className="mt-6">
          <h2
            id="operational-summary"
            className="text-xl font-semibold text-zayan-blue"
          >
            Today&apos;s activity
          </h2>
          {summary ? (
            <>
              <p className="mt-2 text-sm text-muted">
                {summary.scope} · Company date: {date!.format(new Date(summary.generatedAt))} ({summary.timeZone}). Scheduled service records, not financial statements.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summary.metrics
                  .filter((metric) => metric.value !== null && metric.key !== "leads")
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
            Quick actions
          </h2>
          <Link
            href="/admin/manage"
            className="min-h-11 rounded-lg border border-line px-4 py-3 text-sm font-semibold"
          >
            All accounting modules
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
      {user.isSuperAdmin && <AccountingBalances />}
      <footer className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-5 text-sm text-muted">
        <span>Signed in as {user.username}</span>
        <Link href="/" className="min-h-11 py-3 underline">
          View public website
        </Link>
      </footer>
    </section>
  );
}
