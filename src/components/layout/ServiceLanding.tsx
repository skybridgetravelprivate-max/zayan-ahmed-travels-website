import {
  getWebsitePage,
  getWebsitePages,
  getWebsiteSettings,
} from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import Link from "next/link";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import Image from "next/image";
import { TravelIcon } from "@/components/ui/TravelIcon";
import { SearchCard } from "@/components/home/SearchCard";
import { servicePages, type ServicePageKey } from "@/config/service-pages";
import { site } from "@/config/site";

export async function ServiceLanding({ service }: { service: ServicePageKey }) {
  const content = servicePages[service];
  const [page, entries, settings] = await Promise.all([
    getWebsitePage(service),
    getWebsitePages(),
    getWebsiteSettings(),
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
  const primaryService =
    service === "flights"
      ? "Flights"
      : service === "visa"
        ? "Visa"
        : service === "tours"
          ? "Tours"
          : null;
  const icon =
    service === "visa" ? "visa" : service === "tours" ? "tour" : "flight";
  return (
    <>
      {page ? (
        <WebsiteView content={page.content} />
      ) : (
        <>
          <section className="travel-service-hero">
            <div className="travel-container">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">
                  <Link href="/">{site.shortName}</Link> / {content.title}
                </p>
                <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
                  {content.title}
                </h1>
                <p className="mt-5 max-w-2xl leading-8 text-white/85">
                  {content.intro}
                </p>
                <a className="website-cta mt-6" href="#inquiry">
                  Ask the travel desk
                </a>
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
      <section
        className="travel-container travel-catalogue"
        aria-label="Published service information"
      >
        <h2 className="mb-6 text-2xl font-bold">
          {service === "visa"
            ? "Destinations and visa guidance"
            : service === "tours"
              ? "Explore our published itineraries"
              : "Travel options from our desk"}
        </h2>
        <div className="travel-catalogue-grid">
          {publishedEntries.map((p) => (
            <article key={p.slug} className="travel-catalogue-card">
              {p.content.image ? (
                <Image
                  src={p.content.image}
                  alt={p.content.imageAlt}
                  width={640}
                  height={400}
                  unoptimized
                />
              ) : (
                <div className="travel-card-art">
                  <TravelIcon name={icon} />
                </div>
              )}
              <div className="travel-card-body">
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
                <Link
                  className="website-cta"
                  href={`/get-free-quote?service=${service}&destination=${encodeURIComponent(p.content.title)}&reference=${encodeURIComponent(`/pages/${p.slug}`)}`}
                >
                  Request a quotation
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!publishedEntries.length && (
          <div className="travel-empty">
            <h3 className="text-xl font-bold">Tell us what you have in mind</h3>
            <p>
              {service === "visa"
                ? "Share your destination, nationality and travel purpose with our desk to discuss current official requirements. Approval rests with the relevant authority."
                : "Request current options for your dates. Our travel desk will confirm the itinerary, availability and selling price in a written quotation."}
            </p>
            <a href="#inquiry" className="website-cta">
              Prepare an inquiry
            </a>
          </div>
        )}
      </section>
      <section
        id="inquiry"
        className={
          primaryService
            ? "travel-inquiry-section scroll-mt-24"
            : "scroll-mt-24 bg-zayan-blue px-4 py-12 text-white sm:px-6 lg:px-8"
        }
      >
        <div className="travel-container">
          <h2 className="text-3xl font-bold">{content.title} inquiry</h2>
          <p className="mb-6 mt-3 max-w-2xl leading-7">
            Send your requirements to our travel desk. An inquiry does not
            confirm a booking. Do not include payment details or
            identity-document scans.
          </p>
          {primaryService ? (
            <SearchCard
              initialService={primaryService}
              whatsapp={settings.whatsapp}
            />
          ) : (
            <ServiceInquiryForm
              type={content.type}
              submitLabel={`Send ${service === "visa" ? "visa" : service} inquiry`}
            />
          )}
        </div>
      </section>
    </>
  );
}
