import type { Metadata } from "next";
import { InfoHero, InfoSection, Placeholder } from "@/components/layout/InfoPage";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Cancellation policy",
  description: `Placeholder cancellation notes for ${site.legalName} No deadlines or fees are published.`,
};

const sections = [
  {
    title: "Flights",
    text: "A finished note would say how a sample flight booking could be cancelled. No deadline or fee is stated here.",
  },
  {
    title: "Hotels",
    text: "A finished note would say how a sample hotel stay could be cancelled. No deadline or fee is stated here.",
  },
  {
    title: "Tours",
    text: "A finished note would say how a sample tour could be cancelled. No deadline or fee is stated here.",
  },
  {
    title: "Umrah",
    text: "A finished note would say how a sample Umrah plan could be cancelled. No deadline or fee is stated here.",
  },
] as const;

export default function CancellationPolicyPage() {
  return (
    <>
      <InfoHero
        title="Cancellation policy"
        intro={`This page reserves a place for cancellation terms from ${site.legalName} It does not cancel a booking and it does not set a fee.`}
      />
      <InfoSection title="General cancellation terms">
        <Placeholder>
          <p>
            A finished policy would say who can ask for a cancellation and what
            happens next. Those steps are not written yet. Demo booking cards on
            this site are not live trips.
          </p>
        </Placeholder>
      </InfoSection>
      {sections.map((section) => (
        <InfoSection key={section.title} title={section.title}>
          <Placeholder>
            <p>{section.text}</p>
          </Placeholder>
        </InfoSection>
      ))}
    </>
  );
}
