import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { reasons } from "@/config/home";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "About",
  description: `${site.legalName} ${site.tagline}`,
};

const services = [
  { title: "Flights", href: "/flights", description: "Flight planning and quotation enquiries." },
  { title: "Hotels", href: "/hotels", description: "Hotel quotation and accommodation enquiries." },
  { title: "Umrah", href: "/umrah", description: "Umrah planning and published packages for Makkah and Madinah." },
  { title: "Visas", href: "/visa", description: "Visa assistance enquiries. An inquiry does not file an application." },
  { title: "Tours", href: "/tours", description: "Tailored Pakistan and international tour enquiries." },
  { title: "Transport", href: "/transport", description: "Airport, private and group transport enquiries." },
] as const;

export default function AboutPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            About {site.shortName}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            {site.legalName} plans flights, stays, Umrah, visas, tours, and
            transport with one promise: {site.tagline}.
          </p>
        </div>
      </section>

      <Section
        id="mission"
        eyebrow="Purpose"
        title="Mission and values"
        description={site.tagline}
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Card
              title="Mission"
              description="Help travellers understand a plan before they decide, from the first question through departure."
            />
          </li>
          <li>
            <Card
              title="Values"
              description="Clear language, careful Umrah planning, and the same team staying with the journey."
            />
          </li>
        </ul>
      </Section>

      <Section
        id="services"
        className="bg-surface"
        eyebrow="What we plan"
        title="Services overview"
        description="Explore our services and send your requirements to the travel desk."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.href}>
              <Card title={service.title} description={service.description}>
                <Button href={service.href} variant="outline">
                  View {service.title}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="why"
        eyebrow={site.shortName}
        title={`Why choose ${site.shortName}`}
        description={`What travellers can expect from ${site.shortName}.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => (
            <li key={reason.title}>
              <Card title={reason.title} description={reason.description} />
            </li>
          ))}
        </ul>
      </Section>

      <section className="bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Talk with {site.shortName}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            The contact form is checked on this website, then sent to the travel desk. It is not emailed from that page.
          </p>
          <Button href="/contact">Contact us</Button>
        </div>
      </section>
    </>
  );
}
