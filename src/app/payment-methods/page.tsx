import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import {
  InfoHero,
  InfoSection,
  Placeholder,
} from "@/components/layout/InfoPage";
import { Button } from "@/components/ui/Button";
import { site } from "@/config/site";

const fallbackMetadata: Metadata = {
  title: "Payment methods",
  description: `Placeholder payment notes for ${site.legalName}. No accounts or gateways are published.`,
};

const methods = [
  "Card payment",
  "Bank transfer",
  "Payment at the office",
] as const;

export default async function PaymentMethodsPage() {
  const publishedWebsitePage = await getWebsitePage("payment-methods");
  if (publishedWebsitePage)
    return <WebsiteView content={publishedWebsitePage.content} />;

  return (
    <>
      <InfoHero
        title="Payment methods"
        intro={`This page will list how ${site.legalName} can be paid. No method below is active, and no account number is published.`}
      />
      <InfoSection title="Payment information">
        <Placeholder>
          <p>
            This website does not take payment. A finished note would explain
            when a traveller is asked to pay and what proof is given. That note
            is not written yet.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Accepted payment methods">
        <ul className="space-y-4">
          {methods.map((method) => (
            <li key={method}>
              <Placeholder>
                <p>
                  <span className="font-semibold text-foreground">
                    {method}.
                  </span>{" "}
                  Placeholder only. No provider, account number, or fee is
                  shown.
                </p>
              </Placeholder>
            </li>
          ))}
        </ul>
      </InfoSection>
      <section className="bg-zayan-blue px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
          <h2 className="text-3xl font-bold tracking-tight">
            Ask about payment
          </h2>
          <p className="text-base leading-7 text-white/85">
            Use the contact page to ask a question. The form is checked there,
            then sent to the travel desk.
          </p>
          <Button href="/contact">Contact us</Button>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("payment-methods");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
