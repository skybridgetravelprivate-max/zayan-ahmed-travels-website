import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { WebsiteContent, WebsiteSection } from "@/lib/website-content";
import { TravelIllustration } from "@/components/home/TravelIllustration";
import { SearchCard } from "@/components/home/SearchCard";
export function WebsiteSections({
  sections,
  packageContent,
  testimonialContent,
}: {
  sections: WebsiteSection[];
  packageContent?: ReactNode;
  testimonialContent?: ReactNode;
}) {
  return (
    <>
      {sections
        .filter((s) => s.visible)
        .map((s) => (
          <section
            id={s.id}
            key={s.id}
            className={`website-section ${s.layout === "banner" ? "website-banner" : ""}`}
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zayan-blue sm:text-3xl">
                  {s.title}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                  {s.description}
                </p>
              </div>
              {s.id === "packages" && (
                <Link
                  prefetch={false}
                  href="/umrah"
                  className="text-sm font-bold text-zayan-blue underline underline-offset-4"
                >
                  View all packages →
                </Link>
              )}
            </div>
            {s.id === "packages" && packageContent}
            {s.layout === "testimonials" && testimonialContent}
            {s.cards.length ? (
              <div
                className={`website-card-grid ${s.id === "services" ? "website-services" : s.id === "destinations" ? "website-destinations" : ""}`}
              >
                {s.cards.map((c, i) => (
                  <article className="website-card" key={`${s.id}-${i}`}>
                    {c.image ? (
                      <div className="aspect-[16/10] overflow-hidden bg-sky-50">
                        <Image
                          unoptimized
                          src={c.image}
                          alt={c.imageAlt}
                          width={640}
                          height={400}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : s.id === "services" ? (
                      <div
                        className="mx-5 mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-xl font-bold text-zayan-blue"
                        aria-hidden="true"
                      >
                        {["✈", "▥", "◈", "▤", "↔", "◎"][i % 6]}
                      </div>
                    ) : null}
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-zayan-blue">
                        {c.title}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                        {c.text}
                      </p>
                      {c.href && (
                        <Link
                          prefetch={false}
                          className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-zayan-blue underline decoration-zayan-orange decoration-2 underline-offset-4"
                          href={c.href}
                        >
                          {c.label} →
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : s.layout === "testimonials" && !testimonialContent ? (
              <p className="rounded-xl border border-line bg-white p-5 text-sm text-muted">
                No traveller feedback is currently published.
              </p>
            ) : null}
          </section>
        ))}
    </>
  );
}
export function WebsiteHero({
  content: c,
  home = false,
}: {
  content: WebsiteContent;
  home?: boolean;
}) {
  return (
    <section className={`website-hero ${home ? "website-hero-home" : ""}`}>
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-zayan-blue">
            {c.eyebrow}
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight text-zayan-blue sm:text-5xl lg:text-6xl">
            {home && c.title === "Umrah made easier with us" ? (
              <>
                Umrah made
                <br />
                <span className="text-[#c95000]">easier with us</span>
              </>
            ) : (
              c.title
            )}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zayan-blue/90 sm:text-lg">
            {c.summary}
          </p>
          {c.actionHref && (
            <Link
              prefetch={false}
              className="website-cta mt-7"
              href={c.actionHref}
            >
              {c.actionLabel} →
            </Link>
          )}
          <p className="mt-5 text-xs leading-5 text-muted">
            Personalised inquiries · Availability confirmed by the travel desk
          </p>
        </div>
        {c.image ? (
          <div className="overflow-hidden rounded-[2rem] shadow-xl">
            <Image
              unoptimized
              src={c.image}
              alt={c.imageAlt}
              width={900}
              height={600}
              fetchPriority={home ? "high" : "auto"}
              className="aspect-[3/2] h-auto w-full object-cover"
            />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-xl">
            <TravelIllustration />
          </div>
        )}
      </div>
    </section>
  );
}
export function WebsiteView({
  content,
  home = false,
  packageContent,
  testimonialContent,
}: {
  content: WebsiteContent;
  home?: boolean;
  packageContent?: ReactNode;
  testimonialContent?: ReactNode;
}) {
  return (
    <>
      <WebsiteHero content={content} home={home} />
      {home && content.searchEnabled !== false && (
        <div className="relative z-20 mx-auto -mt-6 max-w-7xl px-4 sm:-mt-8 sm:px-8">
          <SearchCard title={content.searchTitle} />
        </div>
      )}
      {content.body && (
        <div className="mx-auto max-w-4xl whitespace-pre-wrap px-5 py-10 text-base leading-8">
          {content.body}
        </div>
      )}
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <WebsiteSections
          sections={content.sections}
          packageContent={packageContent}
          testimonialContent={testimonialContent}
        />
      </div>
    </>
  );
}
