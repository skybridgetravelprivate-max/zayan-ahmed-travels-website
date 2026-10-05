import Link from "next/link";
import { companyContact, navItems, policyLinks, site } from "@/config/site";

export function Footer() {
  const hasPublishedContact =
    companyContact.email.trim().length > 0 || companyContact.address.trim().length > 0;

  return (
    <footer className="border-t border-white/10 bg-zayan-blue text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug">{site.legalName}</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/80">{site.tagline}</p>
        </div>
        <nav aria-label="Footer" className="min-w-0">
          <p className="text-sm font-semibold text-white/90">Explore</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">Contact</p>
          {hasPublishedContact ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/80">
              {companyContact.email.trim() ? (
                <li>
                  <a
                    className="break-all hover:text-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange"
                    href={`mailto:${companyContact.email.trim()}`}
                  >
                    {companyContact.email.trim()}
                  </a>
                </li>
              ) : null}
              {companyContact.address.trim() ? (
                <li className="break-words">{companyContact.address.trim()}</li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/80">
              <Link
                href="/contact"
                className="font-medium text-white underline decoration-white/40 underline-offset-2 hover:text-zayan-orange hover:decoration-zayan-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange"
              >
                View published contact details
              </Link>
            </p>
          )}
        </div>
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
