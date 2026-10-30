import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  StaffNavigation,
  StaffBreadcrumbs,
} from "@/components/admin/StaffNavigation";
import { getStaffIdentity, getStaffModules } from "@/server/staff-api";

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
  let modules: Awaited<ReturnType<typeof getStaffModules>> = [],
    unavailable = false;
  try {
    modules = await getStaffModules();
  } catch {
    unavailable = true;
  }
  const links = modules.map(({ key, title, group }) => ({ key, title, group }));
  return (
    <div className="mx-auto grid w-full max-w-[96rem] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8">
      <a
        href="#staff-content"
        className="sr-only z-50 rounded-lg bg-zayan-blue p-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to workspace content
      </a>
      <StaffNavigation
        fullName={user.fullName}
        modules={links}
        unavailable={unavailable}
      />
      <div id="staff-content" tabIndex={-1} className="min-w-0 outline-none">
        <StaffBreadcrumbs modules={links} />
        {children}
      </div>
    </div>
  );
}
