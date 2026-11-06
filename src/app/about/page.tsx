import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

const fallbackMetadata: Metadata = {
  title: "Your travel desk in Abbottabad",
  description: `Meet ${site.shortName}, your Abbottabad desk for flight, Umrah, visa, stay and holiday planning enquiries.`,
};

const services = [
  {
    title: "Flights",
    href: "/flights",
    description: "Flight planning and quotation enquiries.",
  },
  {
    title: "Hotels",
    href: "/hotels",
    description: "Hotel quotation and accommodation enquiries.",
  },
  {
    title: "Umrah",
    href: "/umrah",
    description:
      "Umrah planning and published packages for Makkah and Madinah.",
  },
  {
    title: "Visas",
    href: "/visa",
    description:
      "Visa assistance enquiries. An inquiry does not file an application.",
  },
  {
    title: "Tours",
    href: "/tours",
    description: "Tailored Pakistan and international tour enquiries.",
  },
  {
    title: "Transport",
    href: "/transport",
    description: "Airport, private and group transport enquiries.",
  },
] as const;

const planningSteps = [
  {
    title: "Share your priorities",
    description:
      "Tell us your dates, destination, group and preferences so the conversation starts with the journey you want to make.",
  },
  {
    title: "Review the details",
    description:
      "Compare the proposed itinerary, inclusions, exclusions, selling currency and quotation validity before deciding.",
  },
  {
    title: "Check the conditions",
    description:
      "Discuss travel-document requirements, service availability and the written booking and payment conditions.",
  },
  {
    title: "Bring the plan together",
    description:
      "Check the final itinerary, accommodation, transfers and travel documents against the agreed arrangements.",
  },
];

export default async function AboutPage() {
  const publishedWebsitePage = await getWebsitePage("about");
  if (publishedWebsitePage)
    return <WebsiteView content={publishedWebsitePage.content} />;

  return (
    <>
      <section className="travel-service-hero">
        <div className="travel-container">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Your travel desk in Abbottabad
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            Bring your flight, Umrah, visa or holiday plans to {site.shortName}.
            Start with your dates and priorities, then review the details in a
            written quotation.
          </p>
          <Button className="mt-6" href="/get-free-quote">
            Start planning your journey
          </Button>
        </div>
      </section>

      <Section
        id="mission"
        eyebrow="Our approach"
        title="A conversation built around your journey"
        description="From a single route to a family itinerary, clear information helps you make the next decision."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          <li>
            <Card
              title="Mission"
              description="Help travellers understand the proposed journey and its conditions before making a decision."
            />
          </li>
          <li>
            <Card
              title="Values"
              description="Clear questions, careful itinerary review and written details that you can refer to throughout planning."
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
        eyebrow="Plan step by step"
        title="From your first question to the final itinerary"
        description="Use these four steps when discussing the arrangements with our desk."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planningSteps.map((reason) => (
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
            Share your destination, dates and travel preferences, or read our
            planning guides to prepare the questions you want to discuss.
          </p>
          <Button href="/contact">Contact us</Button>
          <Button href="/travel-guide" variant="inverse">
            Explore the travel guides
          </Button>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("about");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
