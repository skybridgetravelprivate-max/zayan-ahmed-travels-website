import type { Metadata } from "next";
import { TicketSearch } from "@/components/tickets/TicketSearch";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Tickets",
  description: `Demo ticket search for ${site.legalName}. Sample results only.`,
};

export default function TicketsPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Tickets</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            Search sample tickets below. The form and the cards are a visual demo.
            Nothing is reserved.
          </p>
        </div>
      </section>
      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <TicketSearch />
        </div>
      </div>
    </>
  );
}
