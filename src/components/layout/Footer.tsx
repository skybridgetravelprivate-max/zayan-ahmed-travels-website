import { focusedNavigation } from "@/lib/public-navigation";
import Link from "next/link";
import { policyLinks } from "@/config/site";
import type { WebsiteSettings } from "@/lib/website-content";
import { defaultWebsiteSettings } from "@/config/website";
import { telephoneLink, whatsappLink } from "@/lib/travel-inquiry";
export function Footer({
  settings = defaultWebsiteSettings,
}: {
  settings?: WebsiteSettings;
}) {
  return (
    <footer className="bg-zayan-blue text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div>
          <p className="text-xl font-bold">{settings.companyName}</p>
          <p className="mt-3 text-sm leading-6 text-white/80">
            {settings.tagline}
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="font-bold">Quick links</h2>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {focusedNavigation(settings.nav).map((n) => (
              <li key={n.href}>
                <Link
                  prefetch={false}
                  className="inline-flex min-h-9 items-center hover:underline"
                  href={n.href}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                prefetch={false}
                className="inline-flex min-h-9 items-center hover:underline"
                href="/travel-guide"
              >
                Travel guide
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="font-bold">Contact information</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6">
            {settings.phones.map((p) => (
              <li key={p}>
                <a href={telephoneLink(p)} className="hover:underline">
                  {p}
                </a>
              </li>
            ))}
            {settings.email && (
              <li>
                <a
                  href={`mailto:${settings.email}`}
                  className="break-all hover:underline"
                >
                  {settings.email}
                </a>
              </li>
            )}
            <li>{settings.address}</li>
          </ul>
        </div>
        <div>
          <h2 className="font-bold">Account access</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link className="underline" href="/account">
              Customer account
            </Link>
            <Link className="underline" href="/agent/login">
              Agent access
            </Link>
            <Link className="underline" href="/admin/login">
              Staff access
            </Link>
          </div>
          <h2 className="mt-6 font-bold">Stay connected</h2>
          {settings.whatsapp && (
            <a
              className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-white/40 px-4 py-2 text-sm font-bold"
              target="_blank"
              rel="noopener noreferrer"
              href={whatsappLink(settings.whatsapp)}
            >
              Chat on WhatsApp ↗
            </a>
          )}
          <ul className="mt-4 flex flex-wrap gap-4 text-sm">
            {settings.social.map((s) => (
              <li key={s.href}>
                <a
                  className="underline"
                  href={s.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-5 py-5 text-xs text-white/80 sm:px-8">
          <p>
            © {new Date().getFullYear()} {settings.companyName}
          </p>
          <nav aria-label="Policies" className="flex flex-wrap gap-4">
            {policyLinks.map((n) => (
              <Link
                prefetch={false}
                key={n.href}
                href={n.href}
                className="hover:underline"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
