import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffIdentity, staffRequest } from "@/server/staff-api";
import { StaffLogoutButton } from "@/components/admin/StaffSessionForm";

export const metadata: Metadata = { title: "Staff dashboard", robots: { index: false, follow: false } };
export default async function StaffDashboard() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <section className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-bold">Staff workspace unavailable</h1><p className="mt-3">We could not verify your session. Please try again.</p><Link href="/admin" className="mt-4 inline-block underline">Retry</Link></section>;
  const { user } = identity;
  const allowed = user.isSuperAdmin || user.permissions.includes("dashboard.view");
  let counts: Record<string, unknown> | null = null;
  // The existing summary contains global financial data. Only super-admins
  // request it; scoped staff receive their authorized account workspace only.
  if (user.isSuperAdmin) {
    try { const response = await staffRequest("/api/v1/dashboard/summary"); if (response?.ok) counts = (await response.json()).cards; } catch { /* render unavailable summary */ }
  }
  return <section className="mx-auto max-w-5xl px-4 py-12">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-zayan-orange">Staff workspace</p><h1 className="mt-2 text-3xl font-bold text-zayan-blue">Welcome, {user.fullName}</h1><p className="mt-2 text-sm text-muted">{user.roleNames.join(" · ") || "Staff"}</p></div><StaffLogoutButton /></div>
    {!allowed ? <p role="alert" className="mt-8 rounded-xl border border-line p-5">Your account does not have dashboard access. Contact your administrator.</p> : <>
      <h2 className="mt-10 text-xl font-semibold">Your workspace</h2>
      {user.isSuperAdmin ? counts ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["totalCustomers", "CRM customers"], ["newLeads", "New leads this month"], ["confirmedBookings", "Confirmed bookings"], ["pendingVisa", "Pending visas"]].map(([key, label]) => <article key={key} className="rounded-2xl border border-line bg-surface p-5"><h3 className="text-sm text-muted">{label}</h3><p className="mt-2 text-3xl font-bold text-zayan-blue">{typeof counts?.[key] === "number" ? String(counts[key]) : "Unavailable"}</p></article>)}</div> : <p role="status" className="mt-4">Summary is temporarily unavailable. Refresh to retry.</p> : <p className="mt-4 text-muted">You are signed in. Your administrator manages access to business records.</p>}
      <div className="mt-8 rounded-2xl border border-line p-5"><h2 className="font-semibold">Account access</h2><p className="mt-2 text-sm text-muted">Username: {user.username}</p><p className="mt-2 text-sm">Document uploads remain unavailable until secure persistent storage is configured.</p><Link href="/" className="mt-4 inline-block text-sm underline">View website</Link></div>
    </>}
  </section>;
}
