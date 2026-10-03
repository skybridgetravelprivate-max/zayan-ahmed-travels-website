import type { Metadata } from "next";
import { InfoHero, InfoSection, Placeholder } from "@/components/layout/InfoPage";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund policy",
  description: `Placeholder refund notes for ${site.legalName} No fees or refund rules are published.`,
};

const services = ["Flights", "Hotels", "Tours", "Umrah", "Visas"] as const;

export default function RefundPolicyPage() {
  return (
    <>
      <InfoHero
        title="Refund policy"
        intro={`This page reserves a place for refund terms from ${site.legalName} It does not state a refund amount, fee, or deadline.`}
      />
      <InfoSection title="General refund terms">
        <Placeholder>
          <p>
            A finished policy would say when a payment can be returned and what
            must be asked first. Those rules are not written yet. This website
            does not take payment.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Service-specific terms">
        <ul className="space-y-4">
          {services.map((service) => (
            <li key={service}>
              <Placeholder>
                <p>
                  <span className="font-semibold text-foreground">{service}.</span>{" "}
                  Refund wording for this service is a placeholder. No fee or
                  exception is stated.
                </p>
              </Placeholder>
            </li>
          ))}
        </ul>
      </InfoSection>
    </>
  );
}
