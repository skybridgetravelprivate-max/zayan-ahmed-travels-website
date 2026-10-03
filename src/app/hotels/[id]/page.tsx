import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelInquiry } from "@/components/hotels/HotelInquiry";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { demoHotels, formatNightlyPrice, getDemoHotel } from "@/config/hotels";
import { site } from "@/config/site";

type HotelPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return demoHotels.map((hotel) => ({ id: hotel.id }));
}

export async function generateMetadata({ params }: HotelPageProps): Promise<Metadata> {
  const { id } = await params;
  const hotel = getDemoHotel(id);

  if (!hotel) {
    return { title: "Hotel" };
  }

  return {
    title: hotel.name,
    description: `Demo stay at ${hotel.name} in ${hotel.city}. ${site.shortName}. No room is held.`,
  };
}

export default async function HotelDetailPage({ params }: HotelPageProps) {
  const { id } = await params;
  const hotel = getDemoHotel(id);

  if (!hotel) {
    notFound();
  }

  const amenities = hotel.amenities.split(", ");

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo hotel
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{hotel.name}</h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            {hotel.location}. This page is a sample stay. Nothing is reserved.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#inquiry">Ask about this stay</Button>
            <Button href="/hotels" variant="inverse">
              Back to hotels
            </Button>
          </div>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl">
              <PlaceholderArt caption={hotel.name} tone={hotel.tone} />
            </div>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">About this stay</h2>
              <p className="mt-3 text-base leading-7 text-muted">{hotel.description}</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Rooms</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Sample rooms. No allotment is held.</p>
              <ul className="mt-4 grid gap-4">
                {hotel.rooms.map((room) => (
                  <li key={room.name}>
                    <Card title={room.name} description={room.detail}>
                      <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                        Demo room
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Policies</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Placeholder notes. They are not live hotel rules.
              </p>
              <ul className="mt-4 grid gap-4">
                {hotel.policies.map((policy) => (
                  <li key={policy.title}>
                    <Card title={policy.title} description={policy.text} />
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              {hotel.type} · Demo stay
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="text-muted">Location</dt>
                <dd className="mt-1 font-semibold text-foreground">{hotel.location}</dd>
              </div>
              <div>
                <dt className="text-muted">City</dt>
                <dd className="mt-1 font-semibold text-foreground">{hotel.city}</dd>
              </div>
              <div>
                <dt className="text-muted">Rating</dt>
                <dd className="mt-1 font-semibold text-foreground">{hotel.stars} stars · demo rating</dd>
              </div>
              <div>
                <dt className="text-muted">Demo nightly price</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatNightlyPrice(hotel.price)}</dd>
              </div>
              <div>
                <dt className="text-muted">Amenities</dt>
                <dd className="mt-2">
                  <ul className="space-y-1 font-semibold text-foreground">
                    {amenities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <HotelInquiry hotelName={hotel.name} />
    </>
  );
}
