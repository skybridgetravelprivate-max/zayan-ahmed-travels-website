import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/config/site";

const linkClass =
  "rounded-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-orange";

export function AccountFrame({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: "account" | "bookings";
  children: ReactNode;
}) {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">{intro}</p>
          <nav aria-label="Account">
            <ul className="flex flex-wrap gap-4 text-sm font-semibold">
              <li>
                <Link
                  href="/account"
                  aria-current={current === "account" ? "page" : undefined}
                  className={`${linkClass} ${current === "account" ? "text-white" : "text-white/75"}`}
                >
                  Account
                </Link>
              </li>
              <li>
                <Link
                  href="/my-bookings"
                  aria-current={current === "bookings" ? "page" : undefined}
                  className={`${linkClass} ${current === "bookings" ? "text-white" : "text-white/75"}`}
                >
                  My bookings
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </section>
      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </>
  );
}
