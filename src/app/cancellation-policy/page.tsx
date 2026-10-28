import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import { InfoHero, InfoSection } from "@/components/layout/InfoPage";
import { site } from "@/config/site";

const fallbackMetadata: Metadata = {
  title: "Cancellation policy",
  description: `Contact ${site.legalName} for cancellation or refund terms applicable to your booking.`,
};

export default async function CancellationPolicyPage() {
  const publishedWebsitePage = await getWebsitePage("cancellation-policy");
  if (publishedWebsitePage)
    return <WebsiteView content={publishedWebsitePage.content} />;

  return (
    <>
      <InfoHero
        title="Cancellation policy"
        intro={`For cancellation or refund terms applicable to your booking, please contact ${site.legalName}.`}
      />
      <InfoSection title="Cancellation and refund terms">
        <p>
          Cancellation and refund terms depend on your booking. Please contact{" "}
          {site.legalName} for the terms applicable to your booking.
        </p>
      </InfoSection>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("cancellation-policy");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
