import type { Metadata } from "next";
import Link from "next/link";
import { SearchCard } from "@/components/home/SearchCard";
import { getWebsiteSettings } from "@/server/website-content";
import {
  publicTravelReference,
  type TravelService,
} from "@/lib/travel-inquiry";

export const metadata: Metadata = {
  title: "Request a travel quotation in Abbottabad",
  description:
    "Share your flights, visa, Umrah or tour preferences with Zayan Ahmed Travels. Review a written quotation before deciding.",
  alternates: { canonical: "/get-free-quote" },
};

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    destination?: string;
    reference?: string;
  }>;
}) {
  const [query, settings] = await Promise.all([
    searchParams,
    getWebsiteSettings(),
  ]);
  const services: Record<string, TravelService> = {
    flights: "Flights",
    visa: "Visa",
    umrah: "Umrah",
    tours: "Tours",
  };
  const initialService =
    typeof query.service === "string" && Object.hasOwn(services, query.service)
      ? services[query.service]
      : "Flights";
  const destination =
    typeof query.destination === "string"
      ? query.destination.slice(0, 160)
      : "";
  return (
    <>
      <section className="travel-service-hero">
        <div className="travel-container">
          <nav aria-label="Breadcrumb">
            <Link href="/">Home</Link> / Travel quotation
          </nav>
          <h1>Let’s plan your next journey</h1>
          <p>
            Tell us where you want to go. Our Abbottabad travel desk will check
            options and prepare a written quotation. An inquiry does not reserve
            services or confirm a booking.
          </p>
        </div>
      </section>
      <section className="travel-inquiry-section">
        <div className="travel-container">
          <SearchCard
            key={`${initialService}-${destination}-${publicTravelReference(query.reference)}`}
            initialService={initialService}
            destination={destination}
            reference={publicTravelReference(query.reference)}
            whatsapp={settings.whatsapp}
          />
        </div>
      </section>
    </>
  );
}
