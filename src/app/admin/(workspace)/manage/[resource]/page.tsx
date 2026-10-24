import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { ManagementWorkspace } from "@/components/admin/ManagementWorkspace";
export const metadata: Metadata = { title: "Manage records", robots: { index: false, follow: false } };
export default async function ResourcePage({ params, searchParams }: { params: Promise<{ resource: string }>; searchParams: Promise<{ record?: string }> }) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  const { resource } = await params;
  if (!/^[a-z-]{1,40}$/.test(resource)) return <p role="alert">Module unavailable.</p>;
  const selected = (await searchParams).record;
  const initialId = typeof selected === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(selected) ? selected : undefined;
  return <ManagementWorkspace key={`${resource}-${initialId || ""}`} resource={resource} staffUsername={identity.user.username} initialId={initialId} canAssign={identity.user.isSuperAdmin || identity.user.permissions.includes("lead.assign")} permissions={identity.user.permissions} isSuperAdmin={identity.user.isSuperAdmin} />;
}
