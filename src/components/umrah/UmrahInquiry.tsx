import { SearchCard } from "@/components/home/SearchCard";
import { getWebsiteSettings } from "@/server/website-content";
import type { TravelPreferences } from "@/lib/travel-inquiry";

export async function UmrahInquiry({
  destination,
  reference,
  initialJourney,
}: {
  destination?: string;
  reference?: string;
  initialJourney?: Partial<
    Pick<TravelPreferences, "from" | "departure" | "nights">
  >;
}) {
  const settings = await getWebsiteSettings();
  return (
    <section id="inquiry" className="travel-inquiry-section scroll-mt-24">
      <div className="travel-container">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to ask about Umrah?
        </h2>
        <p className="my-5 max-w-2xl text-base leading-7">
          Share your preferences and request current details from the travel
          desk.
        </p>
        <SearchCard
          initialService="Umrah"
          destination={destination}
          reference={reference}
          initialJourney={initialJourney}
          whatsapp={settings.whatsapp}
        />
      </div>
    </section>
  );
}
