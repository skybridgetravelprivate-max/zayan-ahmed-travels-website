import type { Metadata } from "next";
import { InfoHero, InfoSection } from "@/components/layout/InfoPage";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Cancellation policy",
  description: `Contact ${site.legalName} for cancellation or refund terms applicable to your booking.`,
};

export default function CancellationPolicyPage() {
  return (
    <>
      <InfoHero
        title="Cancellation policy"
        intro={`For cancellation or refund terms applicable to your booking, please contact ${site.legalName}.`}
      />
      <InfoSection title="Cancellation and refund terms">
        <p>
          Cancellation and refund terms depend on your booking. Please contact {site.legalName} for
          the terms applicable to your booking.
        </p>
      </InfoSection>
    </>
  );
}
