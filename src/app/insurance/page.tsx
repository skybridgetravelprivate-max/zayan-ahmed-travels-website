import type { Metadata } from "next";
import { PageInquiry } from "@/components/layout/PageInquiry";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { familyCover, travelCover, umrahCover, type CoverageCard } from "@/config/insurance";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Insurance",
  description: `Demo travel cover labels for ${site.legalName}. Not an insurance policy.`,
};

export default function InsurancePage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Travel insurance
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample labels for travel insurance, Umrah insurance, and family or
            group insurance. These cards are not policies and do not provide cover.
          </p>
          <Button href="#inquiry" variant="inverse">
            Ask about cover
          </Button>
        </div>
      </section>

      <Section
        id="travel"
        eyebrow="Trips"
        title="Travel insurance"
        description="One demo card for a single trip. It is a label only."
      >
        <CoverageGrid cards={travelCover} />
      </Section>

      <Section
        id="umrah-cover"
        className="bg-surface"
        eyebrow="Umrah"
        title="Umrah insurance"
        description="One demo card for an Umrah journey. It is a label only."
      >
        <CoverageGrid cards={umrahCover} />
      </Section>

      <Section
        id="family"
        eyebrow="Together"
        title="Family and group insurance"
        description="Two demo cards for a family and a group. They are labels only."
      >
        <CoverageGrid cards={familyCover} />
      </Section>

      <PageInquiry
        title="Ask about a demo cover label"
        body={`${site.legalName} can explain these sample labels with you. This inquiry stays on the page and does not start a policy.`}
        buttonLabel="Ask about cover"
        status="Demo only. No application was sent."
      />
    </>
  );
}

function CoverageGrid({ cards }: { cards: readonly CoverageCard[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.title}>
          <Card title={card.title} description={card.description}>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted">Sample note</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{card.cover}</dd>
              </div>
              <div>
                <dt className="text-muted">Sample fee</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{card.fee}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo coverage
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
