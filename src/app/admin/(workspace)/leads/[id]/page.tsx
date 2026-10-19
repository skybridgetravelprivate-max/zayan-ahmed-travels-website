import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import type { StaffLeadDetail } from "@/lib/staff-leads";
import { fetchStaffLead } from "@/server/staff-leads";

export const metadata: Metadata = {
  title: "Lead details",
  robots: { index: false, follow: false },
};

function dateLabel(value: string) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export default async function StaffLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Lead unavailable</h1>
        <p className="mt-3">We could not verify your staff session. Retry the workspace.</p>
        <Link href="/admin/leads" className="mt-4 inline-block underline">Back to leads</Link>
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

  const { id } = await params;
  const result = await fetchStaffLead(id);
  if (result.status === "signed-out") redirect("/admin/login");

  if (result.status === "forbidden") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Access denied</h1>
        <p className="mt-3">Your account is not authorized to view this lead.</p>
        <Link href="/admin/leads" className="mt-4 inline-block underline">Back to leads</Link>
      </section>
    );
  }
  if (result.status === "not-found") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Lead unavailable</h1>
        <p className="mt-3">This lead does not exist or is outside your authorized scope.</p>
        <Link href="/admin/leads" className="mt-4 inline-block underline">Back to leads</Link>
      </section>
    );
  }
  if (result.status === "unavailable") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Lead unavailable</h1>
        <p className="mt-3">Lead details could not be loaded. No details were displayed.</p>
        <Link href={`/admin/leads/${encodeURIComponent(id)}`} className="mt-4 inline-block underline">Retry</Link>
      </section>
    );
  }
  if (result.status !== "ok") {
    return (
      <section role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-2xl font-bold text-zayan-blue">Lead unavailable</h1>
        <p className="mt-3">Lead details are unavailable. No details were displayed.</p>
        <Link href="/admin/leads" className="mt-4 inline-block underline">Back to leads</Link>
      </section>
    );
  }

  return <LeadDetails lead={result.data} />;
}

function LeadDetails({ lead }: { lead: StaffLeadDetail }) {
  const contactPhone = encodeURIComponent(lead.mobile);
  const contactEmail = encodeURIComponent(lead.email);
  const fields: [string, string][] = [
    ["Lead number", lead.leadNumber],
    ["Full name", lead.fullName],
    ["Mobile", lead.mobile],
    ["Email", lead.email],
    ["WhatsApp", lead.whatsapp],
    ["City", lead.city],
    ["Country", lead.country],
    ["Source", lead.source],
    ["Status", lead.status],
    ["Priority", lead.priority],
    ["Created", dateLabel(lead.createdAt)],
    ["Travel date", dateLabel(lead.travelDate)],
    ["Return date", dateLabel(lead.returnDate)],
    ["Adults", lead.adults === null ? "" : String(lead.adults)],
    ["Children", lead.children === null ? "" : String(lead.children)],
    ["Infants", lead.infants === null ? "" : String(lead.infants)],
    ["Assigned staff", lead.assignedUser],
    ["Assigned agent", lead.assignedAgent],
  ];
  const visibleFields = fields.filter(([, value]) => value);

  return (
    <section>
      <Link href="/admin/leads" className="text-sm font-medium underline">
        Back to inquiries and leads
      </Link>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-zayan-orange">
        Lead detail · {lead.leadNumber}
      </p>
      <h1 className="mt-2 text-3xl font-bold text-zayan-blue">{lead.fullName}</h1>
      <p className="mt-2 text-sm text-muted">
        Read-only record. Status and assignment changes are not available here.
      </p>
      <Link href={`/admin/manage/leads?record=${encodeURIComponent(lead.id)}`} className="mt-3 inline-block rounded-xl border border-line px-4 py-2 font-semibold underline">Open management controls</Link>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={`tel:${contactPhone}`}
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
        >
          Call lead
        </a>
        {lead.email ? (
          <a
            href={`mailto:${contactEmail}`}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
          >
            Email lead
          </a>
        ) : null}
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleFields.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </dt>
            <dd className="mt-2 break-words text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
