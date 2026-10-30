import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { StaffNavigation } from "@/components/admin/StaffNavigation";
import { getStaffIdentity } from "@/server/staff-api";

export default async function StaffWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-zayan-blue">
          Staff workspace unavailable
        </h1>
        <p className="mt-3 text-muted">
          We could not verify your session. Please try again.
        </p>
        <Link href="/admin" className="mt-4 inline-block underline">
          Retry
        </Link>
      </section>
    );
  }

  const { user } = identity;
  return (
    <div className="mx-auto grid w-full max-w-[96rem] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
      <StaffNavigation
        fullName={user.fullName}
        canViewWebsite={
          user.isSuperAdmin || user.permissions.includes("cms.view")
        }
        canViewDashboard={
          user.isSuperAdmin || user.permissions.includes("dashboard.view")
        }
        canViewLeads={
          user.isSuperAdmin || user.permissions.includes("lead.view")
        }
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
