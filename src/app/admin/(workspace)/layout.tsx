import Link from "next/link";
import { redirect } from "next/navigation";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import {
  StaffNavigation,
  StaffBreadcrumbs,
} from "@/components/admin/StaffNavigation";
import { getStaffIdentity, getStaffModules } from "@/server/staff-api";
import "./crm-typography.css";
import "./accounting-workspace.css";
import { accountingModules } from "@/lib/accounting-workspace";

const inter = localFont({
  src: "../../fonts/inter-variable.woff2",
  variable: "--font-crm-inter",
  weight: "100 900",
  display: "swap",
});

const mono = localFont({
  src: "../../fonts/jetbrains-mono-regular.woff2",
  variable: "--font-crm-mono",
  weight: "400",
  display: "swap",
  preload: false,
});

const typography = `${inter.variable} ${mono.variable} crm-type font-crm-ui text-crm-body`;

export default async function StaffWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") {
    return (
      <section className={`${typography} mx-auto max-w-3xl px-4 py-12`}>
        <h1 className="text-crm-title font-bold text-zayan-blue">
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
  const links = accountingModules(modules).map(({ key, title, group }) => ({ key, title, group }));
  if (user.isSuperAdmin) links.push({ key: "accounting-reports", title: "Reports", group: "Reports" });
  if (user.isSuperAdmin) links.push({ key: "journal-voucher", title: "New journal voucher", group: "Vouchers" });
  links.push({ key: "communication-recovery", title: "Communication recovery", group: "Administration" });
  if (user.isSuperAdmin || user.permissions.includes("ticket.view")) {
    links.push({ key: "issued-ticket-invoices", title: "Issued ticket invoices", group: "Travel invoices" });
  }
  return (
    <div className={`${typography} accounting-workspace`}>
      <header className="accounting-topbar">
        <Link href="/admin" className="accounting-brand">Zayan <strong>Accounts</strong></Link>
        <span className="accounting-topbar-title">Zayan Ahmed Travels</span>
        <span className="accounting-user-name">{user.fullName}</span>
      </header>
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
      <div id="staff-content" tabIndex={-1} className="accounting-content min-w-0 outline-none">
        <StaffBreadcrumbs modules={links} />
        {children}
      </div>
    </div>
  );
}
