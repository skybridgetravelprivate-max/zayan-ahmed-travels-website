import Link from "next/link";
import { navItems, policyLinks, site } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-zayan-blue text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8">
        <div>
          <p className="text-lg font-bold">{site.legalName}</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/80">
            {site.tagline}
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="inline-flex rounded-md py-1 text-white/85 transition-colors hover:text-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <nav aria-label="Policies" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {policyLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm text-white/75 hover:text-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/70">© 2026 {site.legalName}</p>
        </nav>
      </div>
    </footer>
  );
}
