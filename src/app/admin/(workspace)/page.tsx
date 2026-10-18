import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffIdentity, staffRequest } from "@/server/staff-api";

export const metadata: Metadata = {
  title: "Staff dashboard",
  robots: { index: false, follow: false },
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export default async function StaffDashboard() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">
          Staff workspace unavailable
        </h1>
        <p className="mt-3 text-muted">We could not verify your session. Please try again.</p>
        <Link href="/admin" className="mt-4 inline-block underline">Retry</Link>
      </section>
    );
  }

  const { user } = identity;
  const canViewLeads = user.isSuperAdmin || user.permissions.includes("lead.view");
  const canViewDashboard =
    user.isSuperAdmin || user.permissions.includes("dashboard.view");
  let counts: Record<string, unknown> | null = null;
  let summaryUnavailable = false;

  if (user.isSuperAdmin) {
    try {
      const response = await staffRequest("/api/v1/dashboard/summary");
      if (response?.ok) {
        const body = record(await response.json());
        counts = record(body?.cards);
        if (!counts) summaryUnavailable = true;
      } else {
        summaryUnavailable = true;
      }
    } catch {
      summaryUnavailable = true;
    }
  }

  if (!canViewDashboard && !canViewLeads) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Staff dashboard</h1>
        <p role="alert" className="mt-4">
          Your account does not have access to an implemented staff workspace.
          Contact your administrator.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">
        Staff workspace
      </p>
      <h1 className="mt-2 text-3xl font-bold text-zayan-blue">
        Welcome, {user.fullName}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {user.roleNames.join(" · ") || "Staff"}
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zayan-blue">
        Your workspace
      </h2>
      <Link href="/admin/manage" className="mt-4 block rounded-2xl border border-line bg-surface p-5 hover:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue">
        <span className="block text-lg font-semibold text-zayan-blue">Management console</span>
        <span className="mt-2 block text-sm text-muted">Manage authorized customers, leads, assignments, tasks, travel records, and administration.</span>
      </Link>
      {canViewLeads ? (
        <Link
          href="/admin/leads"
          className="mt-4 block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
        >
          <span className="block text-sm text-muted">CRM</span>
          <span className="mt-1 block text-lg font-semibold text-zayan-blue">
            Inquiries and leads
          </span>
          <span className="mt-2 block text-sm text-muted">
            View leads you are authorized to access.
          </span>
        </Link>
      ) : null}

      {user.isSuperAdmin ? (
        summaryUnavailable || !counts ? (
          <p role="status" className="mt-4 rounded-xl border border-line p-4">
            Summary is temporarily unavailable. Refresh to retry.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["totalCustomers", "CRM customers"],
              ["newLeads", "New leads this month"],
              ["confirmedBookings", "Confirmed bookings"],
              ["pendingVisa", "Pending visas"],
            ].map(([key, label]) => (
              <article
                key={key}
                className="rounded-2xl border border-line bg-surface p-5"
              >
                <h3 className="text-sm text-muted">{label}</h3>
                <p className="mt-2 text-3xl font-bold text-zayan-blue">
                  {typeof counts?.[key] === "number"
                    ? String(counts[key])
                    : "Unavailable"}
                </p>
              </article>
            ))}
          </div>
        )
      ) : null}

      {canViewDashboard && !canViewLeads ? (
        <p className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          No additional staff modules are available in this workspace yet.
        </p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-zayan-blue">Account access</h2>
        <p className="mt-2 text-sm text-muted">Username: {user.username}</p>
        <p className="mt-2 text-sm">
          Document uploads remain unavailable until secure persistent storage is
          configured.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          View public website
        </Link>
      </div>
    </section>
  );
}
