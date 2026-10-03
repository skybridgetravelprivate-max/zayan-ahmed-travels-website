"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Card } from "@/components/ui/Card";
import { demoOffers, offerCategories } from "@/config/offers";

export function OfferBoard() {
  const [category, setCategory] = useState<string>(offerCategories[0]);

  const visible = useMemo(
    () =>
      demoOffers.filter(
        (offer) => category === "All categories" || offer.category === category,
      ),
    [category],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">Category</h2>
        <label htmlFor="offer-category" className="mt-4 block text-sm font-medium">
          Category filter
          <select
            id="offer-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue sm:max-w-xs"
          >
            {offerCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <p className="mt-4 text-xs leading-5 text-muted">
          Visual demo only. These offers are not live promotions.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
          No demo offers match this category.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((offer) => (
            <li key={offer.id}>
              <Link
                href={`/offers/${offer.id}`}
                className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
              >
                <Card
                  title={offer.title}
                  description={offer.description}
                  media={<PlaceholderArt caption={offer.title} tone={offer.tone} />}
                >
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-muted">Category</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{offer.category}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Sample price</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{offer.price}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                    {offer.validity}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
