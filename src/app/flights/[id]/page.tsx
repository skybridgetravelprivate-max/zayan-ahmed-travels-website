import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RouteBand } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { demoFlights, formatDemoPrice, getDemoFlight } from "@/config/flights";
import { site } from "@/config/site";

type FlightPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return demoFlights.map((flight) => ({ id: flight.id }));
}

export async function generateMetadata({ params }: FlightPageProps): Promise<Metadata> {
  const { id } = await params;
  const flight = getDemoFlight(id);

  if (!flight) {
    return { title: "Flight" };
  }

  return {
    title: `${flight.from} to ${flight.to}`,
    description: `Demo flight from ${flight.from} to ${flight.to} with ${flight.airline}. ${site.shortName}. This is not a live fare.`,
  };
}

export default async function FlightDetailPage({ params }: FlightPageProps) {
  const { id } = await params;
  const flight = getDemoFlight(id);

  if (!flight) {
    notFound();
  }

  const rows = [
    ["Airline", flight.airline],
    ["Route", `${flight.from} – ${flight.to}`],
    ["Departure", `${flight.depart} · ${flight.from}`],
    ["Arrival", `${flight.arrive} · ${flight.to}`],
    ["Duration", flight.duration],
    ["Stops", flight.stops],
    ["Baggage", flight.baggage],
    ["Cabin class", "Not set on this sample result"],
  ] as const;

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo flight
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {flight.airline}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample flight result. This page does not check a seat or offer a live fare.
          </p>
          <Button href="/flights" variant="inverse">
            Back to flights
          </Button>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-3xl">
            <RouteBand from={flight.from} to={flight.to} />
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo fare
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold text-foreground">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-muted">Demo price</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatDemoPrice(flight.price)}</dd>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sample figure only. This is not a live fare, and no seat is held.
                </p>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
