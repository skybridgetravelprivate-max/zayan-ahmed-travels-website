import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { WebsiteContent, WebsiteSection } from "@/lib/website-content";
import { TravelIllustration } from "@/components/home/TravelIllustration";
import { SearchCard } from "@/components/home/SearchCard";
import { TravelIcon } from "@/components/ui/TravelIcon";
import type { WebsiteSettings } from "@/lib/website-content";
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
            className={`website-section travel-section-${s.id} ${s.layout === "banner" ? "website-banner" : ""}`}
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
                    ) : s.id === "offers" ? (
                      <div className="travel-card-art">
                        <TravelIcon name="flight" />
                      </div>
                    ) : s.id === "services" ? (
                      <div
                        className="mx-5 mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-xl font-bold text-zayan-blue"
                        aria-hidden="true"
                      >
                        <TravelIcon
                          name={
                            c.href === "/umrah"
                              ? "umrah"
                              : c.href === "/visa"
                                ? "visa"
                                : c.href === "/tours"
                                  ? "tour"
                                  : "flight"
                          }
                        />
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
                Traveller stories will appear here when shared with permission.
                In the meantime, talk to our Abbottabad desk about your journey.
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
  settings,
}: {
  content: WebsiteContent;
  home?: boolean;
  settings?: WebsiteSettings;
}) {
  return (
    <section className={`website-hero ${home ? "website-hero-home" : ""}`}>
      <div className="travel-container travel-hero-grid">
        <div>
          <p className="travel-eyebrow">{c.eyebrow}</p>
          <h1 className="travel-hero-title">
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
          <p className="travel-hero-description">{c.summary}</p>
          {c.actionHref && !home && (
            <Link
              prefetch={false}
              className="website-cta mt-7"
              href={c.actionHref}
            >
              {c.actionLabel} →
            </Link>
          )}
          <p className="travel-hero-note">
            Personalised planning · Written quotations · Abbottabad travel desk
          </p>
        </div>
        {home && c.searchEnabled !== false ? (
          <SearchCard
            title={c.searchTitle}
            initialService={
              c.actionHref.startsWith("/umrah") ? "Umrah" : "Flights"
            }
            whatsapp={settings?.whatsapp}
          />
        ) : c.image ? (
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
  settings,
}: {
  content: WebsiteContent;
  home?: boolean;
  packageContent?: ReactNode;
  testimonialContent?: ReactNode;
  settings?: WebsiteSettings;
}) {
  return (
    <>
      <WebsiteHero content={content} home={home} settings={settings} />
      {home && (
        <div className="travel-container">
          <ul className="travel-proof-strip">
            {(
              [
                ["pin", "Abbottabad", "Visit our travel desk"],
                ["quote", "Written quotes", "Review before you decide"],
                ["umrah", "Tailored planning", "Your dates and preferences"],
                ["phone", "Personal support", "Phone, WhatsApp and email"],
              ] as const
            ).map(([icon, label, text]) => (
              <li key={label}>
                <TravelIcon name={icon} />
                <div>
                  <strong>{label}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.body && (
        <div className="mx-auto max-w-4xl whitespace-pre-wrap px-5 py-10 text-base leading-8">
          {content.body}
        </div>
      )}
      <div className="travel-container">
        <WebsiteSections
          sections={content.sections}
          packageContent={packageContent}
          testimonialContent={testimonialContent}
        />
      </div>
    </>
  );
}
