import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { UmrahInquiry } from "@/components/umrah/UmrahInquiry";
import { UmrahPackages } from "@/components/umrah/UmrahPackages";
import { site } from "@/config/site";
import { serviceNotes } from "@/config/umrah";
import { getPublicUmrahPackages } from "@/server/crm-umrah";

export const metadata: Metadata = {
  title: "Umrah",
  description: `Umrah packages for ${site.legalName} Demo packages stay labelled as samples.`,
};

export default async function UmrahPage() {
  const packages = await getPublicUmrahPackages();
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Umrah services
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            {packages.length > 0
              ? "Published packages for Makkah and Madinah, with visa guidance, hotels, transport, and ziyarat notes. Nothing on this page is a live booking."
              : "Sample packages for Makkah and Madinah, with visa guidance, hotels, transport, and ziyarat notes. Nothing on this page is a live booking."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#packages">View packages</Button>
            <Button href="#inquiry" variant="inverse">
              Contact us
            </Button>
          </div>
        </div>
      </section>

      <div id="packages" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <UmrahPackages packages={packages} />
        </div>
      </div>

      <Section
        id="visa"
        className="bg-surface"
        eyebrow="Documents"
        title="Umrah Visa"
        description="Guidance notes only. This page does not submit a visa application."
      >
        <NoteGrid notes={serviceNotes.visa} />
      </Section>

      <Section
        id="stay"
        eyebrow="Stays"
        title="Hotels"
        description="Makkah and Madinah hotel names on the package cards are samples."
      >
        <NoteGrid notes={serviceNotes.hotels} />
      </Section>

      <Section
        id="transport"
        className="bg-surface"
        eyebrow="Getting around"
        title="Transport"
        description="Transfer styles shown on the demo packages."
      >
        <NoteGrid notes={serviceNotes.transport} />
      </Section>

      <Section
        id="ziyarat"
        eyebrow="Visits"
        title="Ziyarat"
        description="Outline notes for visits. These are not confirmed departures."
      >
        <NoteGrid notes={serviceNotes.ziyarat} />
      </Section>

      <UmrahInquiry />
    </>
  );
}

function NoteGrid({
  notes,
}: {
  notes: readonly { title: string; description: string }[];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <li key={note.title}>
          <Card title={note.title} description={note.description} />
        </li>
      ))}
    </ul>
  );
}
