import type { Metadata } from "next";
import { InfoHero, InfoSection, Placeholder } from "@/components/layout/InfoPage";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Placeholder privacy notes for ${site.legalName}. Not a final privacy policy.`,
};

export default function PrivacyPage() {
  return (
    <>
      <InfoHero
        title="Privacy"
        intro={`This page sets out the sections a privacy note for ${site.legalName} will use. It is a placeholder and does not describe a live data practice.`}
      />
      <InfoSection title="What this page covers">
        <Placeholder>
          <p>
            A finished policy would name the site it applies to and who to ask
            about it. Those details are not filled in yet. The contact page
            shows an address or email only when one is published.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Data collection">
        <Placeholder>
          <p>
            Inquiry forms are checked on this website, then sent to the travel
            desk. A finished section would list any information the company
            actually collects. That list is not written yet.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="How information would be used">
        <Placeholder>
          <p>
            A finished section would say why information is kept and who can see
            it. No use is described here.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Customer rights">
        <Placeholder>
          <p>
            A finished section would explain how a person can ask about their
            information. This placeholder does not state a legal right or a
            response time.
          </p>
        </Placeholder>
      </InfoSection>
    </>
  );
}
