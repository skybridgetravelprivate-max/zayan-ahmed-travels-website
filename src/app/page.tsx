import { SearchCard } from "@/components/home/SearchCard";
import { PlaceholderArt, RouteBand } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import {
  flightRoutes,
  hotels,
  reasons,
  testimonials,
  tours,
  umrahPackages,
  visaServices,
} from "@/config/home";
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
            <Button href="/#umrah">Explore Umrah Packages</Button>
            <Button href="/#contact" variant="inverse">
              Contact us
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
        title="Featured Umrah Packages"
        description="Three sample packages for layout only. Dates, hotels, and fares are not live."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {umrahPackages.map((item) => (
            <li key={item.title}>
              <Card
                title={item.title}
                description={item.description}
                media={
                  <PlaceholderArt caption={item.title} tone={item.tone} />
                }
              >
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  {item.detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="flights"
        className="bg-surface"
        eyebrow="Flights"
        title="Popular Flight Destinations"
        description="Sample routes from Islamabad. These cards do not show live fares."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {flightRoutes.map((route) => (
            <li key={`${route.from}-${route.to}`}>
              <Card
                title={`${route.from} – ${route.to}`}
                description="Demo route. No seats are searched and no fare is quoted."
                media={<RouteBand from={route.from} to={route.to} />}
              >
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  Demo route
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="hotels"
        eyebrow="Hotels"
        title="Featured Hotels"
        description="Three sample stays. No property is booked from this page."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((item) => (
            <li key={item.title}>
              <Card
                title={item.title}
                description={item.description}
                media={
                  <PlaceholderArt caption={item.title} tone={item.tone} />
                }
              >
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  {item.detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="visas"
        className="bg-surface"
        eyebrow="Visas"
        title="Visa Services"
        description="Service categories only. This page does not file an application."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visaServices.map((item) => (
            <li key={item.title}>
              <Card title={item.title} description={item.description}>
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  Demo service
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="tours"
        eyebrow="Tours"
        title="Popular Tours"
        description="Three sample itineraries. Nothing on this page is a confirmed departure."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tours.map((item) => (
            <li key={item.title}>
              <Card
                title={item.title}
                description={item.description}
                media={
                  <PlaceholderArt caption={item.title} tone={item.tone} />
                }
              >
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  {item.detail}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="why"
        className="bg-surface"
        eyebrow={site.shortName}
        title={`Why choose ${site.shortName}`}
        description={`What travellers can expect from ${site.shortName}.`}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((item, index) => (
            <li key={item.title}>
              <Card
                title={item.title}
                description={item.description}
                icon={
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zayan-orange/10 text-sm font-bold">
                    {index + 1}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="stories"
        eyebrow="Stories"
        title="Traveller notes"
        description={
          liveTestimonials
            ? "Published notes from the travel desk."
            : "Sample quotes written for this layout. They are not customer reviews."
        }
      >
        <ul className="grid gap-4 lg:grid-cols-3">
          {liveTestimonials
            ? publishedTestimonials.map((item) => (
                <li key={item.id}>
                  <Card title={item.author} description={`“${item.quote}”`}>
                    <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                      Published testimonial
                    </p>
                  </Card>
                </li>
              ))
            : testimonials.map((item) => (
                <li key={item.name}>
                  <Card
                    title={`Demo testimonial · ${item.name}`}
                    description={`“${item.quote}”`}
                  >
                    <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                      Demo testimonial
                    </p>
                  </Card>
                </li>
              ))}
        </ul>
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
            {site.legalName} can walk through flights, stays, Umrah, visas, and
            tours with you. This call to action stays on the homepage and does
            not send a message.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/#umrah">Explore Umrah Packages</Button>
            <Button href="/#search" variant="inverse">
              Back to search
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
