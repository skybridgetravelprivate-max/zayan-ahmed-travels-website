import type { Metadata } from "next";
import { PageInquiry } from "@/components/layout/PageInquiry";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Corporate",
  description: `Corporate travel services from ${site.legalName} The inquiry is checked on this website, then sent to the travel desk.`,
};

const services = [
  {
    title: "Corporate travel services",
    description:
      "A single desk for company trips. This page describes the service. It does not open an account.",
  },
  {
    title: "Flight management",
    description:
      "Sample support for planning company air travel. Fares on this site are demo labels.",
  },
  {
    title: "Hotel accommodation",
    description:
      "Sample support for company stays. No room is held from this page.",
  },
  {
    title: "Visa assistance",
    description:
      "Sample guidance for business travel documents. This page does not file an application.",
  },
  {
    title: "Ground transport",
    description:
      "Sample airport and city transfers for company travellers. No vehicle is reserved.",
  },
] as const;

export default function CorporatePage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Corporate travel
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            {site.tagline} Company travel is described here as a service outline,
            not a live booking desk.
          </p>
        </div>
      </section>

      <Section
        id="services"
        eyebrow="Companies"
        title="Corporate travel services"
        description="Flight management, hotel accommodation, visa assistance, and ground transport."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.title}>
              <Card title={service.title} description={service.description}>
                <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  Demo service
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <PageInquiry
        title="Corporate inquiry"
        body={`${site.legalName} can talk through a company travel outline with you. This inquiry is checked on the website, then sent to the travel desk.`}
        buttonLabel="Start an inquiry"
        inquiryType="corporate"
        status="Demo only. No message was sent."
      />
    </>
  );
}
