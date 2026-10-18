"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navItems, site } from "@/config/site";

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange";

const primaryDesktopLabels = new Set([
  "Flights",
  "Hotels",
  "Tours",
  "Umrah",
  "Visas",
  "Contact",
]);

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const primaryItems = navItems.filter((item) =>
    primaryDesktopLabels.has(item.label),
  );
  const moreItems = navItems.filter(
    (item) => item.label !== "Home" && !primaryDesktopLabels.has(item.label),
  );

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-[96rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={`flex shrink-0 items-center gap-3 rounded-xl ${focusRing}`}
          onClick={closeMenu}
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zayan-blue text-sm font-bold tracking-tight text-white"
          >
            <span className="text-zayan-orange">Z</span>A
          </span>
          <span className="leading-tight">
            <span className="block whitespace-nowrap text-xs font-bold text-zayan-blue sm:text-sm lg:text-base">
              {site.shortName}
            </span>
            <span className="hidden text-[11px] text-muted sm:block sm:text-xs">
              {site.tagline}
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center justify-end gap-0.5 whitespace-nowrap">
            {primaryItems.map((item) => {
              const current = isCurrent(pathname, item.href);

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`rounded-full px-2 py-2 text-sm font-medium transition-colors ${focusRing} ${
                      current
                        ? "bg-zayan-blue text-white"
                        : "text-foreground hover:bg-zayan-blue/5 hover:text-zayan-blue"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <details className="group relative">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1 rounded-full px-2.5 py-2 text-sm font-medium text-foreground transition-colors marker:hidden hover:bg-zayan-blue/5 hover:text-zayan-blue ${focusRing}`}
                >
                  More
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                  >
                    <path
                      d="m3 6 5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <ul className="absolute right-0 top-full z-50 mt-2 grid w-56 gap-1 rounded-2xl border border-line bg-surface p-2 shadow-xl">
                  {moreItems.map((item) => {
                    const current = isCurrent(pathname, item.href);

                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          aria-current={current ? "page" : undefined}
                          className={`block rounded-xl px-3 py-2 text-sm font-medium ${focusRing} ${
                            current
                              ? "bg-zayan-blue text-white"
                              : "text-foreground hover:bg-zayan-blue/5 hover:text-zayan-blue"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          </ul>
        </nav>

        <button
          ref={menuButtonRef}
          type="button"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue xl:hidden`}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-navigation"
          aria-label="Menu"
          className="max-h-[min(70vh,32rem)] overflow-y-auto border-t border-line bg-surface xl:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {navItems.map((item) => {
              const current = isCurrent(pathname, item.href);

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    onClick={closeMenu}
                    className={`block rounded-xl px-3 py-3 text-base font-medium ${focusRing} ${
                      current
                        ? "bg-zayan-blue text-white"
                        : "text-foreground hover:bg-zayan-blue/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
