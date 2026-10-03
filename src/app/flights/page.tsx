import type { Metadata } from "next";
import { FlightSearch } from "@/components/flights/FlightSearch";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Flights",
  description: `Demo flight search for ${site.legalName} Sample results only.`,
};

export default function FlightsPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Flights
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            Round trip, one way, and multi city. The form and the cards below
            are a visual demo.
          </p>
        </div>
      </section>
      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <FlightSearch />
        </div>
      </div>
    </>
  );
}
