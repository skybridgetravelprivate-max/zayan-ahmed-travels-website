"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StaffLogoutButton } from "@/components/admin/StaffSessionForm";

export function StaffNavigation({
  fullName,
  canViewDashboard,
  canViewLeads,
  canViewWebsite,
}: {
  fullName: string;
  canViewDashboard: boolean;
  canViewLeads: boolean;
  canViewWebsite: boolean;
}) {
  const pathname = usePathname();
  const links = [
    ...(canViewWebsite
      ? [{ label: "Website management", href: "/admin/website" }]
      : []),
    { label: "Management", href: "/admin/manage" },
    ...(canViewDashboard || canViewLeads
      ? [{ label: "Dashboard", href: "/admin" }]
      : []),
    ...(canViewLeads
      ? [{ label: "Inquiries & leads", href: "/admin/leads" }]
      : []),
  ];

  return (
    <nav
      aria-label="Staff workspace"
      className="rounded-2xl border border-line bg-surface p-3 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3 px-2 py-1 lg:block lg:px-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Staff workspace
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-zayan-blue">
            {fullName}
          </p>
        </div>
        <StaffLogoutButton />
      </div>
      {links.length ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto lg:flex-col">
          {links.map((link) => {
            const current =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue ${
                    current
                      ? "bg-zayan-blue text-white"
                      : "text-foreground hover:bg-zayan-blue/5 hover:text-zayan-blue"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
}
