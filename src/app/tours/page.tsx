import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { TourBoard } from "@/components/tours/TourBoard";
import { TourInquiry } from "@/components/tours/TourInquiry";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Tours",
  description: `Demo tours for ${site.legalName} Sample itineraries only.`,
};

export default function ToursPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Tour services
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample tours for Pakistan, international trips, families, honeymoons,
            and groups. Prices on this page are demo figures, not live departures.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#tours">View tours</Button>
            <Button href="#inquiry" variant="inverse">
              Contact us
            </Button>
          </div>
        </div>
      </section>

      <div id="tours" className="scroll-mt-24 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <TourBoard />
        </div>
      </div>

      <TourInquiry />
    </>
  );
}
