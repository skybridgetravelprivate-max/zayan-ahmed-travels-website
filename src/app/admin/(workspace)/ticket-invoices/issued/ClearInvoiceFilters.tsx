"use client";

import Link from "next/link";

export function ClearInvoiceFilters({ href, className }: { href: string; className: string }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
          event.currentTarget.closest("form")?.reset();
        }
      }}
    >
      Clear Filters
    </Link>
  );
}
