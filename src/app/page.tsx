import { SearchCard } from "@/components/home/SearchCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";
import { getPublicTestimonials } from "@/server/crm-testimonials";

export default async function Home() {
  const publishedTestimonials = await getPublicTestimonials();
  const liveTestimonials = publishedTestimonials.length > 0;
  return (
    <>
      <section className="relative overflow-hidden bg-zayan-blue text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-zayan-orange/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-16 pb-28 sm:px-6 sm:pt-24 sm:pb-32 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {site.tagline}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Flights, Hotels, Umrah, Visas and Complete Travel Solutions
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/contact">Ask about travel options</Button>
            <Button href="/#umrah" variant="inverse">
              View service information
            </Button>
          </div>
        </div>
      </section>

      <div className="relative z-10 -mt-16 px-4 sm:-mt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SearchCard />
        </div>
      </div>

      <Section
        id="umrah"
        eyebrow="Umrah"
        title="Umrah travel"
        description="Current Umrah packages, dates, hotels, and prices are not published on this page."
      >
        <AvailabilityNotice service="Umrah travel" />
      </Section>

      <Section
        id="flights"
        className="bg-surface"
        eyebrow="Flights"
        title="Flight enquiries"
        description="This site does not search live flights or publish current fares."
      >
        <AvailabilityNotice service="flights" />
      </Section>

      <Section
        id="hotels"
        eyebrow="Hotels"
        title="Hotel enquiries"
        description="No current hotel listings, room availability, or rates are published on this page."
      >
        <AvailabilityNotice service="hotels" />
      </Section>

      <Section
        id="visas"
        className="bg-surface"
        eyebrow="Visas"
        title="Visa Services"
        description="Current visa service information is not published on this page."
      >
        <AvailabilityNotice service="visa services" />
      </Section>

      <Section
        id="tours"
        eyebrow="Tours"
        title="Tour enquiries"
        description="Current itineraries and departure availability are not published on this page."
      >
        <AvailabilityNotice service="tours" />
      </Section>

      <Section
        id="why"
        className="bg-surface"
        eyebrow={site.shortName}
        title="Planning with our travel team"
        description="Use the contact form to send an inquiry. It is not a live availability search or a booking."
      >
        <Button href="/contact">Open contact form</Button>
      </Section>

      <Section
        id="stories"
        eyebrow="Stories"
        title="Traveller notes"
        description={
          liveTestimonials
            ? "Published traveller notes."
            : "No published traveller notes are available right now."
        }
      >
        {liveTestimonials ? (
          <ul className="grid gap-4 lg:grid-cols-3">
            {publishedTestimonials.map((item) => (
              <li key={item.id}>
                <Card title={item.author} description={`“${item.quote}”`}>
                  <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                    Published testimonial
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <section
        id="contact"
        className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Ready for your next journey?
          </h2>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            {site.legalName} provides a contact form for travel inquiries.
            Sending an inquiry does not confirm availability or create a booking.
          </p>
          <Button href="/contact">Open contact form</Button>
        </div>
      </section>
    </>
  );
}

function AvailabilityNotice({ service }: { service: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Contact the travel team to ask about {service}. This page does not
        display confirmed availability or prices.
      </p>
      <Button href="/contact" className="shrink-0">
        Ask about {service}
      </Button>
    </div>
  );
}
