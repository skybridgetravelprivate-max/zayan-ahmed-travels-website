import type { Metadata } from "next";
import { PageInquiry } from "@/components/layout/PageInquiry";
import { OfferBoard } from "@/components/offers/OfferBoard";
import { Button } from "@/components/ui/Button";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Offers",
  description: `Demo offers for ${site.legalName}. Sample promotions only.`,
};

export default function OffersPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Offers
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Six sample promotions. Each card shows a demo validity label. None of
            these prices are live.
          </p>
          <Button href="#inquiry" variant="inverse">
            Contact us
          </Button>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <OfferBoard />
        </div>
      </div>

      <PageInquiry
        title="Ask about a sample offer"
        body={`${site.legalName} can walk through a demo promotion with you. This inquiry stays on the page and is not sent.`}
        buttonLabel="Ask about this offer"
        status="Demo only. No message was sent."
      />
    </>
  );
}
