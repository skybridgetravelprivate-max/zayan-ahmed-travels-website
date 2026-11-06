import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TravelIcon } from "@/components/ui/TravelIcon";
import { UmrahInquiry } from "@/components/umrah/UmrahInquiry";
import { Button } from "@/components/ui/Button";
import type { PublicUmrahPackage } from "@/lib/public-umrah";
import { site } from "@/config/site";
import { getPublicUmrahPackages } from "@/server/crm-umrah";
import type { TravelPreferences } from "@/lib/travel-inquiry";

type PackagePageProps = {
  params: Promise<{ id: string }>;
};

function included(value: boolean | null) {
  if (value === null) return "";
  return value ? "Included" : "Not included";
}

function publishedRows(item: PublicUmrahPackage) {
  return [
    ["Duration", item.durationDays === null ? "" : `${item.durationDays} days`],
    ["Package type", item.packageType],
    ["Departure", item.departureCity],
    ["Arrival", item.arrivalCity],
    ["Departure date", item.departureDate],
    ["Return date", item.returnDate],
    ["Makkah hotel", item.makkahHotel?.name || ""],
    ["Makkah distance (desk-listed)", item.makkahHotel?.distance || ""],
    ["Madinah hotel", item.madinahHotel?.name || ""],
    ["Madinah distance (desk-listed)", item.madinahHotel?.distance || ""],
    [
      "Makkah nights",
      item.makkahNights === null ? "" : String(item.makkahNights),
    ],
    [
      "Madinah nights",
      item.madinahNights === null ? "" : String(item.madinahNights),
    ],
    ["Room type", item.roomType],
    ["Transport", included(item.includesTransport)],
    ["Visa", included(item.includesVisa)],
    ["Meals", included(item.includesMeals)],
    ["Ziyarat", included(item.includesZiyarat)],
    ["Flight", item.flightInfo],
  ].filter((row): row is [string, string] => row[1].length > 0);
}

export async function generateMetadata({
  params,
}: PackagePageProps): Promise<Metadata> {
  const { id } = await params;
  const published = await getPublicUmrahPackages();
  if (published.length > 0) {
    const item = published.find((row) => row.id === id);
    return item
      ? {
          title: item.name,
          description: `Published Umrah package from ${site.shortName}. Nothing is reserved.`,
        }
      : { title: "Umrah package" };
  }
  return { title: "Umrah package" };
}

export default async function UmrahPackagePage({ params }: PackagePageProps) {
  const { id } = await params;
  const published = await getPublicUmrahPackages();

  if (published.length > 0) {
    const item = published.find((row) => row.id === id);
    if (!item) notFound();
    return (
      <PackageDetail
        eyebrow="Published package"
        name={item.name}
        intro="Published package details. Nothing is reserved from this page."
        rows={publishedRows(item)}
        description={item.description}
        reference={`/umrah/${encodeURIComponent(item.id)}`}
        initialJourney={{
          from: item.departureCity,
          departure: item.departureDate,
          ...(item.makkahNights !== null && item.madinahNights !== null
            ? { nights: String(item.makkahNights + item.madinahNights) }
            : {}),
        }}
      />
    );
  }

  notFound();
}

function PackageDetail({
  eyebrow,
  name,
  intro,
  rows,
  description,
  reference,
  initialJourney,
}: {
  eyebrow: string;
  name: string;
  intro: string;
  rows: readonly [string, string][];
  description: string;
  reference: string;
  initialJourney: Partial<
    Pick<TravelPreferences, "from" | "departure" | "nights">
  >;
}) {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {eyebrow}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {name}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">{intro}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#inquiry">Start an inquiry</Button>
            <Button href="/umrah#packages" variant="inverse">
              Back to packages
            </Button>
          </div>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="travel-card-art overflow-hidden rounded-3xl">
              <TravelIcon name="umrah" />
            </div>
            {description ? (
              <section>
                <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">
                  Description
                </h2>
                <p className="mt-3 text-base leading-7 whitespace-pre-wrap text-muted">
                  {description}
                </p>
              </section>
            ) : null}
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              {eyebrow}
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>

      <UmrahInquiry
        destination={name}
        reference={reference}
        initialJourney={initialJourney}
      />
    </>
  );
}
