"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteChrome({
  children,
  header,
  footer,
  notice,
  structuredData,
  contact,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  notice: ReactNode;
  structuredData: ReactNode;
  contact: ReactNode;
}) {
  const pathname = usePathname();
  const isStaffRoute =
    pathname === "/agent" ||
    pathname?.startsWith("/agent/") === true ||
    pathname === "/reset-password" ||
    pathname === "/admin" ||
    pathname?.startsWith("/admin/") === true;

  if (isStaffRoute) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <div className="public-site flex min-h-screen flex-1 flex-col">
      {structuredData}
      {notice}
      {header}
      <a
        href="#main-content"
        className="sr-only z-50 bg-white p-3 text-zayan-blue focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {footer}
      {contact}
    </div>
  );
}
