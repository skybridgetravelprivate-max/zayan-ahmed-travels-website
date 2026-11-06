import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { UmrahPlanner } from "@/components/umrah/UmrahPlanner";
import { UmrahPackages } from "@/components/umrah/UmrahPackages";
import { site } from "@/config/site";
import { umrahQuestions, combinationTrips } from "@/config/umrah-planning";
import { getPublicUmrahPackages } from "@/server/crm-umrah";

const fallbackMetadata: Metadata = {
  title: "Umrah packages & personalised travel planning",
  description: `Plan Umrah with ${site.shortName}: departure preferences, hotels, transport, package enquiries and Makkah and Madinah travel planning.`,
};
const services = [
  {
    title: "Flights",
    text: "Request direct or connecting flights, baggage details and the full travel schedule.",
    href: "/flights",
  },
  {
    title: "Makkah & Madinah hotels",
    text: "Compare location, walking distance, room occupancy, accessibility and shuttle arrangements.",
    href: "/hotels",
  },
  {
    title: "Visa guidance",
    text: "Ask the desk to check current requirements for your nationality, residence and proposed dates.",
    href: "/visa",
  },
  {
    title: "Ground transport",
    text: "Discuss airport transfers, travel between the holy cities and private or shared vehicles.",
    href: "/transport",
  },
  {
    title: "Ziyarat",
    text: "Request a visit itinerary, transport arrangements and a clear list of included services.",
    href: "#inquiry",
  },
  {
    title: "Insurance & travel requirements",
    text: "Confirm applicable cover, exclusions and current entry requirements before committing to travel.",
    href: "/insurance",
  },
];
const steps = [
  [
    "Choose your preferences",
    "Select an origin, duration and accommodation preference. Share any family, mobility or assistance needs.",
  ],
  [
    "Review a written quotation",
    "Confirm exact hotels, flights, hotel nights, room sharing, inclusions, exclusions and the quote's validity.",
  ],
  [
    "Agree booking and payment terms",
    "Check cancellation, refund and payment policies. An inquiry alone does not confirm your booking.",
  ],
  [
    "Check your travel documents",
    "Review the final flight itinerary, visa information and hotel and transfer vouchers before departure.",
  ],
];

export default async function UmrahPage() {
  const publishedWebsitePage = await getWebsitePage("umrah");

  const packages = await getPublicUmrahPackages();
  return (
    <>
      {publishedWebsitePage ? (
        <WebsiteView content={publishedWebsitePage.content} />
      ) : (
        <section className="bg-zayan-blue text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-300">
              {site.shortName}
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
              Your Umrah journey, thoughtfully planned
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85">
              Plan your time in Makkah and Madinah around your dates, budget and
              family. Explore travel preferences and request a personalised
              quotation from our team.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="#plan">Plan my Umrah</Button>
              <Button href="#packages" variant="inverse">
                Published packages
              </Button>
            </div>
            <nav
              aria-label="Umrah page sections"
              className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm"
            >
              <a className="underline" href="#services">
                Services
              </a>
              <a className="underline" href="#combinations">
                Umrah extensions
              </a>
              <a className="underline" href="#guide">
                Planning guide
              </a>
              <a className="underline" href="#faq">
                Common questions
              </a>
            </nav>
          </div>
        </section>
      )}
      <Section
        id="packages"
        eyebrow="Package catalogue"
        title="Published Umrah packages"
        description="Only reviewed packages published by our travel desk appear here. Availability and final terms require confirmation."
      >
        <UmrahPackages packages={packages} />
      </Section>
      <Section
        id="services"
        className="bg-surface"
        eyebrow="Plan the details"
        title="A complete itinerary starts with clear choices"
        description="Request a full package or ask about individual services. Confirm each item in your written quotation."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="rounded-2xl border border-line bg-white p-6"
            >
              <h3 className="text-xl font-bold text-zayan-blue">
                {service.title}
              </h3>
              <p className="mt-3 leading-7 text-muted">{service.text}</p>
              <Link
                className="mt-4 inline-block font-semibold text-zayan-blue underline"
                href={service.href}
              >
                Ask about {service.title.toLowerCase()}
              </Link>
            </article>
          ))}
        </div>
      </Section>
      <Section
        id="combinations"
        eyebrow="Optional extensions"
        title="Explore an Umrah combination"
        description="Custom-trip requests, not confirmed departures. Entry and transit requirements, schedules and prices must be checked."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {combinationTrips.map((place) => (
            <article
              key={place}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <h3 className="text-xl font-bold text-zayan-blue">
                Umrah + {place}
              </h3>
              <p className="mt-3 text-muted">
                Discuss a{" "}
                {place === "Saudi Arabia"
                  ? "Saudi city or ziyarat extension"
                  : `stopover or additional stay in ${place}`}{" "}
                with the travel desk.
              </p>
              <a
                href="#plan"
                className="mt-4 inline-block font-semibold text-zayan-blue underline"
              >
                Choose in the inquiry planner
              </a>
            </article>
          ))}
        </div>
      </Section>
      <Section
        id="guide"
        className="bg-surface"
        eyebrow="Before you book"
        title="Four steps to a clear travel plan"
      >
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map(([title, text], index) => (
            <li
              key={title}
              className="rounded-2xl border border-line bg-white p-6"
            >
              <p className="font-semibold text-zayan-orange">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-xl font-bold text-zayan-blue">
                {title}
              </h3>
              <p className="mt-3 leading-7 text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <h3 className="text-xl font-bold text-zayan-blue">
            Choose hotels for the people travelling
          </h3>
          <p className="mt-3 leading-7 text-muted">
            Consider walking distance, actual shuttle times, lifts, room sharing
            and access for older travellers or children. Ask for hotel names and
            locations rather than relying on a star label alone. Compare private
            and shared transport, luggage space and transfer timing. Raise
            special requirements before accepting a quote.
          </p>
        </div>
        <Link
          className="mt-5 inline-flex min-h-11 items-center font-semibold text-zayan-blue underline"
          href="/travel-guide/umrah"
        >
          Read the Umrah planning guide →
        </Link>
      </Section>
      <UmrahPlanner />
      <Section
        id="faq"
        eyebrow="Helpful answers"
        title="Umrah planning questions"
        description="General planning guidance. Travel rules and availability must be checked for your circumstances and dates."
      >
        <div className="space-y-3">
          {umrahQuestions.map(([question, answer]) => (
            <details
              key={question}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <summary className="cursor-pointer font-semibold text-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue">
                {question}
              </summary>
              <p className="mt-3 max-w-4xl leading-7 text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("umrah");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
