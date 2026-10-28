import Link from "next/link";
import { WebsiteView } from "@/components/website/WebsiteView";
import { UmrahPackages } from "@/components/umrah/UmrahPackages";
import { defaultHomepage } from "@/config/website";
import { getWebsitePage } from "@/server/website-content";
import { getPublicUmrahPackages } from "@/server/crm-umrah";
import { getPublicTestimonials } from "@/server/crm-testimonials";
export default async function Home() {
  const [page, packages, testimonials] = await Promise.all([
    getWebsitePage("home"),
    getPublicUmrahPackages(),
    getPublicTestimonials(),
  ]);
  const notes = testimonials.length ? (
    <div className="grid gap-4 sm:grid-cols-3">
      {testimonials.map((t) => (
        <figure
          key={t.id}
          className="rounded-2xl border border-line bg-white p-5"
        >
          <blockquote className="text-sm leading-7 text-muted">
            “{t.quote}”
          </blockquote>
          <figcaption className="mt-4 font-bold text-zayan-blue">
            {t.author}
          </figcaption>
        </figure>
      ))}
    </div>
  ) : undefined;
  return (
    <>
      <WebsiteView
        content={page?.content || defaultHomepage}
        home
        packageContent={<UmrahPackages packages={packages} />}
        testimonialContent={notes}
      />
      <section className="bg-zayan-blue px-5 py-12 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold">Let’s plan your next journey</h2>
            <p className="mt-3 text-white/85">
              Share your dates, destination and travel preferences.
            </p>
          </div>
          <Link prefetch={false} className="website-cta" href="/contact">
            Talk to our travel desk →
          </Link>
        </div>
      </section>
    </>
  );
}
