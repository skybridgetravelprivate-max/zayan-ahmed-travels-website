import type { Metadata } from "next";
import { GroupBookingForm } from "@/components/group-booking/GroupBookingForm";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Group booking",
  description: `Group travel with ${site.legalName}. The inquiry is checked on this website, then sent to the travel desk.`,
};

const features = [
  {
    title: "One conversation",
    description: "Flights, stays, and transfers for a group can be discussed together.",
  },
  {
    title: "Umrah groups",
    description: "Planning enquiries for families and larger Umrah parties. Availability requires confirmation.",
  },
  {
    title: "Shared transport",
    description: "Ask about coaches or private cars suitable for your group.",
  },
  {
    title: "Clear headcount",
    description: "The form asks how many travellers are in the party. It does not hold seats.",
  },
] as const;

export default function GroupBookingPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Group booking
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            {site.tagline}. Group travel is planned as one outline for the whole
            party. This page does not confirm seats or rooms.
          </p>
        </div>
      </section>

      <Section
        id="features"
        eyebrow="Groups"
        title="Services and features"
        description="Share your group requirements. An inquiry does not hold an allotment."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title}>
              <Card title={feature.title} description={feature.description} />
            </li>
          ))}
        </ul>
      </Section>

      <section className="bg-surface px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Group inquiry</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Name, phone, email, destination, travel date, travellers, and message
            are checked here, then sent to the travel desk.
          </p>
          <div className="mt-6">
            <GroupBookingForm />
          </div>
        </div>
      </section>
    </>
  );
}
