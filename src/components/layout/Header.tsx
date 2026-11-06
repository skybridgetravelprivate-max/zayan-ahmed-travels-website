"use client";
import { focusedNavigation, primaryServices } from "@/lib/public-navigation";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { defaultWebsiteSettings } from "@/config/website";
import type { WebsiteSettings } from "@/lib/website-content";
import { TravelIcon } from "@/components/ui/TravelIcon";
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
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) {
          setOpen(false);
          toggle.current?.focus();
        }
        const expanded =
          header.current?.querySelector<HTMLDetailsElement>("details[open]");
        if (expanded) {
          expanded.open = false;
          expanded.querySelector("summary")?.focus();
        }
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const primary = new Set(primaryServices.map((item) => item.href));
  const links = focusedNavigation(settings.nav);
  const current = (href: string) =>
    href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  const link = (n: { label: string; href: string }) => (
    <Link
      prefetch={false}
      href={n.href}
      onClick={(e) => {
        setOpen(false);
        const details = e.currentTarget.closest("details");
        if (details) details.open = false;
      }}
      aria-current={current(n.href) ? "page" : undefined}
      className={`${focus} block rounded-lg px-2 py-3 text-sm font-semibold ${current(n.href) ? "text-[#b84c08] underline decoration-2 underline-offset-8" : "text-zayan-blue hover:bg-sky-50"}`}
    >
      {n.label}
    </Link>
  );
  return (
    <header
      ref={header}
      className="travel-header sticky top-0 z-40 border-b border-line bg-white"
    >
      <div className="sr-only">
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
      <div className="travel-container flex min-h-20 items-center justify-between gap-4">
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
            <span aria-hidden="true" className="travel-brand-mark">
              ZA
            </span>
          )}
          <span className="travel-brand-name">{settings.companyName}</span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links
              .filter((n) => primary.has(n.href))
              .map((n) => (
                <li key={n.href} className="travel-nav-service">
                  <details>
                    <summary>
                      <TravelIcon
                        name={
                          n.href === "/flights"
                            ? "flight"
                            : n.href === "/visa"
                              ? "visa"
                              : n.href === "/tours"
                                ? "tour"
                                : "umrah"
                        }
                      />
                      {n.label}
                      <span aria-hidden="true">⌄</span>
                    </summary>
                    <ul>
                      <li>{link(n)}</li>
                      <li>
                        {link({
                          label: "Request a quotation",
                          href: `/get-free-quote?service=${n.href.slice(1)}`,
                        })}
                      </li>
                    </ul>
                  </details>
                </li>
              ))}
            {links
              .filter((n) => !primary.has(n.href))
              .map((n) => (
                <li key={n.href}>{link(n)}</li>
              ))}
          </ul>
        </nav>
        <Link
          prefetch={false}
          href="/get-free-quote"
          className="travel-quote-link hidden shrink-0 xl:inline-flex"
        >
          Get a free travel quote
        </Link>
        <button
          ref={toggle}
          type="button"
          className={`${focus} flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line text-2xl text-zayan-blue lg:hidden`}
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
          className="max-h-[65vh] overflow-y-auto border-t border-line bg-white p-4 lg:hidden"
        >
          <ul className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {links.map((n) => (
              <li key={n.href}>{link(n)}</li>
            ))}
            <li>
              {link({
                label: "Get a free travel quote",
                href: "/get-free-quote",
              })}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
