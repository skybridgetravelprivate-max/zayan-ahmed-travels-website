import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { ManagementWorkspace } from "@/components/admin/ManagementWorkspace";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  return {
    title: resource
      .replaceAll("-", " ")
      .replace(/^./, (char) => char.toUpperCase()),
    robots: { index: false, follow: false },
  };
}
export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ record?: string; lead?: string }>;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated")
    return <p role="alert">Staff session could not be verified.</p>;
  const { resource } = await params;
  if (!/^[a-z-]{1,40}$/.test(resource))
    return <p role="alert">Module unavailable.</p>;
  const query = await searchParams;
  const selected = query.record;
  const initialLeadId =
    ["follow-ups", "tasks"].includes(resource) &&
    typeof query.lead === "string" &&
    /^[A-Za-z0-9_-]{1,80}$/.test(query.lead)
      ? query.lead
      : undefined;
  if (
    selected !== undefined &&
    (typeof selected !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(selected))
  )
    return (
      <p role="alert">
        The requested record reference is invalid. Open the module again.
      </p>
    );
  const initialId =
    typeof selected === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(selected)
      ? selected
      : undefined;
  return (
    <ManagementWorkspace
      key={`${resource}-${initialId || ""}-${initialLeadId || ""}`}
      resource={resource}
      staffUsername={identity.user.username}
      initialId={initialId}
      initialLeadId={initialLeadId}
      canAssign={
        identity.user.isSuperAdmin ||
        identity.user.permissions.includes("lead.assign")
      }
      permissions={identity.user.permissions}
      isSuperAdmin={identity.user.isSuperAdmin}
    />
  );
}
