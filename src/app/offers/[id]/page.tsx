import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { demoOffers, getDemoOffer } from "@/config/offers";
import { site } from "@/config/site";

type OfferPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return demoOffers.map((offer) => ({ id: offer.id }));
}

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { id } = await params;
  const offer = getDemoOffer(id);

  if (!offer) {
    return { title: "Offer" };
  }

  return {
    title: offer.title,
    description: `Demo offer: ${offer.title}. ${site.shortName}. This is not a live promotion.`,
  };
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
  const { id } = await params;
  const offer = getDemoOffer(id);

  if (!offer) {
    notFound();
  }

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo offer
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{offer.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample promotion. This page does not apply a discount or book a trip.
          </p>
          <Button href="/offers" variant="inverse">
            Back to offers
          </Button>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl">
              <PlaceholderArt caption={offer.title} tone={offer.tone} />
            </div>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Description</h2>
              <p className="mt-3 text-base leading-7 text-muted">{offer.description}</p>
            </section>
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo offer
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="text-muted">Offer title</dt>
                <dd className="mt-1 font-semibold text-foreground">{offer.title}</dd>
              </div>
              <div>
                <dt className="text-muted">Category</dt>
                <dd className="mt-1 font-semibold text-foreground">{offer.category}</dd>
              </div>
              <div>
                <dt className="text-muted">Validity</dt>
                <dd className="mt-1 font-semibold text-foreground">{offer.validity}</dd>
              </div>
              <div>
                <dt className="text-muted">Sample price</dt>
                <dd className="mt-1 font-semibold text-foreground">{offer.price}</dd>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sample figure only. This is not a live price.
                </p>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
