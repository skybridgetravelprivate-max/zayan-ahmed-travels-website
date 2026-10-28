import { getWebsitePage, getWebsitePages } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import Link from "next/link";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { TravelIllustration } from "@/components/home/TravelIllustration";
import { servicePages, type ServicePageKey } from "@/config/service-pages";
import { site } from "@/config/site";

export async function ServiceLanding({ service }: { service: ServicePageKey }) {
  const content = servicePages[service];
  const [page, entries] = await Promise.all([
    getWebsitePage(service),
    getWebsitePages(),
  ]);
  const category = (
    {
      flights: "flight",
      hotels: "hotel",
      tours: "tour",
      offers: "offer",
      visa: "visa",
      transport: "transport",
    } as Record<string, string>
  )[service];
  const publishedEntries = entries.filter(
    (p) => category && p.content.category === category && p.slug !== service,
  );
  return (
    <>
      {page ? (
        <WebsiteView content={page.content} />
      ) : (
        <>
          <section className="bg-zayan-blue text-white">
            <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">
                  {site.shortName}
                </p>
                <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
                  {content.title}
                </h1>
                <p className="mt-5 max-w-2xl leading-8 text-white/85">
                  {content.intro}
                </p>
                <a
                  className="mt-6 inline-block rounded-xl bg-zayan-orange px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  href="#inquiry"
                >
                  Ask the travel desk
                </a>
              </div>
              <div className="mx-auto w-full max-w-lg">
                <TravelIllustration />
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-zayan-blue">
              Plan with clear information
            </h2>
            <ul className="mt-5 grid gap-4 sm:grid-cols-3">
              {content.points.map((point) => (
                <li
                  key={point}
                  className="rounded-2xl border border-line bg-surface p-5 leading-7"
                >
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">
              Availability and prices require a current quotation. This page
              does not search live inventory, reserve services or take payment.
            </p>
          </section>
        </>
      )}
      {!!publishedEntries.length && (
        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-8 sm:grid-cols-3">
          {publishedEntries.map((p) => (
            <article key={p.slug} className="website-card p-5">
              <h2 className="text-xl font-bold text-zayan-blue">
                {p.content.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {p.content.summary}
              </p>
              <Link
                prefetch={false}
                className="mt-4 inline-block font-bold underline"
                href={`/pages/${p.slug}`}
              >
                View details →
              </Link>
            </article>
          ))}
        </section>
      )}
      <section
        id="inquiry"
        className="scroll-mt-24 bg-zayan-blue px-4 py-12 text-white sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">{content.title} inquiry</h2>
          <p className="mb-6 mt-3 max-w-2xl leading-7 text-white/85">
            Send your requirements to our travel desk. An inquiry does not
            confirm a booking. Do not include payment details or
            identity-document scans.
          </p>
          <ServiceInquiryForm
            type={content.type}
            submitLabel={`Send ${service === "visa" ? "visa" : service} inquiry`}
          />
        </div>
      </section>
    </>
  );
}
