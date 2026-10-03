import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/travel-guide/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { guideCategories } from "@/config/travel-guide";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Travel Guide",
  description: `Sample travel notes from ${site.legalName} on Umrah, visas, flights, hotels, airports, currency, and travel tips.`,
};

export default function TravelGuidePage() {
  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Travel Guide", href: "/travel-guide" },
            ]}
          />
        </div>
      </div>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Travel Guide
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
            Sample articles for reading the demo pages on this site. They are
            not live briefings, bookings, or official rules.
          </p>
        </div>
      </section>
      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="sr-only">Categories</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guideCategories.map((category) => (
              <li key={category.slug}>
                <Card title={category.title} description={category.summary}>
                  <Button href={`/travel-guide/${category.slug}`}>Open category</Button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
