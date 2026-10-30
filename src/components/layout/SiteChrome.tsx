"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SiteChrome({
  children,
  header,
  footer,
  notice,
  structuredData,
}: {
  children: ReactNode;
  header: ReactNode;
  footer: ReactNode;
  notice: ReactNode;
  structuredData: ReactNode;
}) {
  const pathname = usePathname();
  const isStaffRoute =
    pathname === "/reset-password" || pathname === "/admin" || pathname?.startsWith("/admin/") === true;

  if (isStaffRoute) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      {structuredData}
      {notice}
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
