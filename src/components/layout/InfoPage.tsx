import type { ReactNode } from "react";
import { site } from "@/config/site";

export function InfoHero({ title, intro }: { title: string; intro: string }) {
  return (
    <section className="bg-zayan-blue text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
          {site.legalName}
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">{intro}</p>
      </div>
    </section>
  );
}

export function InfoSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">{title}</h2>
        <div className="mt-4 space-y-4 text-base leading-7 text-foreground">{children}</div>
      </div>
    </section>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
        Placeholder
      </p>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </div>
  );
}
