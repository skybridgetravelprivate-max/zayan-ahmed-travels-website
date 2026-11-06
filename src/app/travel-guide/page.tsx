import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import Link from "next/link";
import { InfoHero, InfoSection } from "@/components/layout/InfoPage";
import { TravelIllustration } from "@/components/home/TravelIllustration";
import { guideCategories } from "@/config/travel-guide";
const fallbackMetadata: Metadata = {
  title: "Travel planning guide",
  description:
    "A practical checklist for comparing itineraries, preparing documents and confirming travel arrangements.",
};
const tips = [
  [
    "Compare complete quotations",
    "Check the full itinerary, baggage, room occupancy, transfers, meals and cancellation conditions. Ask which services are included and when the quotation expires.",
  ],
  [
    "Check documents before booking",
    "Verify current entry and transit requirements for your nationality, residence and dates with the appropriate official sources. Ask the desk about assistance; do not assume visa approval.",
  ],
  [
    "Choose suitable accommodation",
    "Confirm the exact property, room type, location, accessibility and shuttle arrangements. Tell the desk about children, older travellers or assistance needs.",
  ],
  [
    "Keep your arrangements together",
    "Review tickets and vouchers before departure. Keep the travel desk's contact details available and check any changes directly before travelling.",
  ],
];
export default async function GuidePage() {
  const publishedWebsitePage = await getWebsitePage("travel-guide");
  return (
    <>
      {publishedWebsitePage ? (
        <WebsiteView content={publishedWebsitePage.content} />
      ) : (
        <InfoHero
          title="Prepare for your next journey"
          intro="Use this checklist when discussing your trip with the travel desk."
        />
      )}
      <section
        className="travel-container py-12"
        aria-labelledby="planning-guides"
      >
        <h2 id="planning-guides" className="text-3xl font-bold">
          Explore our planning guides
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-muted">
          Original guidance from Zayan Ahmed Travels to help you ask the right
          questions and review your travel arrangements.
        </p>
        <div className="travel-catalogue-grid mt-7">
          {guideCategories.map((guide) => (
            <article key={guide.slug} className="travel-catalogue-card p-6">
              <h3 className="text-xl font-bold">{guide.title}</h3>
              <p className="mt-3 leading-7 text-muted">{guide.summary}</p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center font-bold underline"
                href={`/travel-guide/${guide.slug}`}
              >
                Read {guide.title.toLowerCase()} →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <InfoSection title="Plan with confidence">
        <div className="mx-auto max-w-md">
          <TravelIllustration />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {tips.map(([title, text]) => (
            <section
              key={title}
              className="rounded-xl border border-line bg-surface p-5"
            >
              <h3 className="font-bold text-zayan-blue">{title}</h3>
              <p className="mt-3">{text}</p>
            </section>
          ))}
        </div>
        <Link
          href="/contact"
          className="inline-block font-semibold text-zayan-blue underline"
        >
          Ask about your travel plan
        </Link>
      </InfoSection>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("travel-guide");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
