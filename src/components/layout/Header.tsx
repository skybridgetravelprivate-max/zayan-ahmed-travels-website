"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { defaultWebsiteSettings } from "@/config/website";
import type { WebsiteSettings } from "@/lib/website-content";
const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zayan-blue";
export function Header({
  settings = defaultWebsiteSettings,
}: {
  settings?: WebsiteSettings;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const primary = new Set([
    "Home",
    "Flights",
    "Hotels",
    "Umrah",
    "Visas",
    "Tours",
    "Offers",
    "About",
    "Contact",
  ]);
  const links = settings.nav;
  const current = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  const link = (n: { label: string; href: string }) => (
    <Link
      prefetch={false}
      href={n.href}
      onClick={() => setOpen(false)}
      aria-current={current(n.href) ? "page" : undefined}
      className={`${focus} block rounded-lg px-2 py-3 text-sm font-semibold ${current(n.href) ? "text-[#b84c08] underline decoration-2 underline-offset-8" : "text-zayan-blue hover:bg-sky-50"}`}
    >
      {n.label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="hidden border-b border-line bg-sky-50/70 lg:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-8 py-2 text-xs text-zayan-blue">
          <span>{settings.address}</span>
          <div className="flex flex-wrap gap-5">
            {settings.phones.map((p) => (
              <a
                href={`tel:${p.replace(/[^+0-9]/g, "")}`}
                className={focus}
                key={p}
              >
                {p}
              </a>
            ))}
            {settings.email && (
              <a className={focus} href={`mailto:${settings.email}`}>
                {settings.email}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-5 px-4 sm:px-8">
        <Link
          prefetch={false}
          href="/"
          onClick={() => setOpen(false)}
          className={`${focus} flex min-w-0 items-center gap-3`}
        >
          {settings.logo ? (
            <>
              <Image
                unoptimized
                src={settings.logo}
                alt={settings.logoAlt}
                width={52}
                height={52}
                className="h-12 w-12 object-contain"
              />
            </>
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zayan-orange text-lg font-extrabold text-zayan-blue"
            >
              ZA
            </span>
          )}
          <span className="max-w-[14rem] text-sm font-extrabold leading-tight text-zayan-blue sm:text-base">
            {settings.companyName}
          </span>
        </Link>
        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {links
              .filter((n) => primary.has(n.label))
              .map((n) => (
                <li key={n.href}>{link(n)}</li>
              ))}
            <li>
              <details className="relative">
                <summary
                  className={`${focus} cursor-pointer rounded-lg px-2 py-3 text-sm font-semibold text-zayan-blue`}
                >
                  More
                </summary>
                <ul className="absolute right-0 z-50 mt-2 grid w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
                  {links
                    .filter((n) => !primary.has(n.label))
                    .map((n) => (
                      <li key={n.href}>{link(n)}</li>
                    ))}
                </ul>
              </details>
            </li>
          </ul>
        </nav>
        <Link
          prefetch={false}
          href="/contact"
          className="website-cta hidden shrink-0 2xl:inline-flex"
        >
          Travel inquiry →
        </Link>
        <button
          ref={toggle}
          type="button"
          className={`${focus} flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line text-2xl text-zayan-blue xl:hidden`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
      {settings.announcement && (
        <p
          role="status"
          className="bg-zayan-blue px-4 py-2 text-center text-sm text-white"
        >
          {settings.announcement}
        </p>
      )}
      {open && (
        <nav
          id="mobile-navigation"
          aria-label="Menu"
          className="max-h-[65vh] overflow-y-auto border-t border-line bg-white p-4 xl:hidden"
        >
          <ul className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {links.map((n) => (
              <li key={n.href}>{link(n)}</li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
