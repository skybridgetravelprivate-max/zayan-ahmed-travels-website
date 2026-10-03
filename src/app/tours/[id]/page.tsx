import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { TourInquiry } from "@/components/tours/TourInquiry";
import { Button } from "@/components/ui/Button";
import { demoTours, formatTourPrice, getDemoTour } from "@/config/tours";
import { site } from "@/config/site";

type TourPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return demoTours.map((tour) => ({ id: tour.id }));
}

export async function generateMetadata({ params }: TourPageProps): Promise<Metadata> {
  const { id } = await params;
  const tour = getDemoTour(id);

  if (!tour) {
    return { title: "Tour" };
  }

  return {
    title: `${tour.destination} tour`,
    description: `Demo tour for ${tour.destination}. ${site.shortName}. This is not a departure.`,
  };
}

export default async function TourDetailPage({ params }: TourPageProps) {
  const { id } = await params;
  const tour = getDemoTour(id);

  if (!tour) {
    notFound();
  }

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo tour
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {tour.destination}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample tour information. This page does not confirm a departure or book a tour.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#inquiry">Start an inquiry</Button>
            <Button href="/tours#tours" variant="inverse">
              Back to tours
            </Button>
          </div>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl">
              <PlaceholderArt caption={tour.destination} tone={tour.tone} />
            </div>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Description</h2>
              <p className="mt-3 text-base leading-7 text-muted">{tour.description}</p>
            </section>
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo tour
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="text-muted">Destination</dt>
                <dd className="mt-1 font-semibold text-foreground">{tour.destination}</dd>
              </div>
              <div>
                <dt className="text-muted">Duration</dt>
                <dd className="mt-1 font-semibold text-foreground">{tour.duration}</dd>
              </div>
              <div>
                <dt className="text-muted">Category</dt>
                <dd className="mt-1 font-semibold text-foreground">{tour.category}</dd>
              </div>
              <div>
                <dt className="text-muted">Demo price</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatTourPrice(tour.price)}</dd>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sample figure only. This is not a live departure price.
                </p>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <TourInquiry />
    </>
  );
}
