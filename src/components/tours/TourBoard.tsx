"use client";

import { useId, useMemo, useState } from "react";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  demoTours,
  destinations,
  durations,
  formatTourPrice,
  tourCategories,
} from "@/config/tours";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

export function TourBoard() {
  const baseId = useId();
  const [destination, setDestination] = useState<string>(destinations[0]);
  const [category, setCategory] = useState<string>("All categories");
  const [duration, setDuration] = useState<string>(durations[0]);

  const visible = useMemo(
    () =>
      demoTours.filter((tour) => {
        const destinationMatch =
          destination === "All destinations" || tour.destination === destination;
        const categoryMatch = category === "All categories" || tour.category === category;
        const durationMatch = duration === "Any duration" || tour.duration === duration;
        return destinationMatch && categoryMatch && durationMatch;
      }),
    [category, destination, duration],
  );

  return (
    <div className="space-y-8">
      <div
        role="group"
        aria-label="Tour category"
        className="flex gap-2 overflow-x-auto"
      >
        {["All categories", ...tourCategories].map((item) => {
          const selected = category === item;

          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue ${
                selected
                  ? "bg-zayan-blue text-white"
                  : "bg-surface text-foreground hover:text-zayan-blue"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <SelectField
            id={`${baseId}-destination`}
            label="Destination"
            value={destination}
            options={destinations}
            onChange={setDestination}
          />
          <SelectField
            id={`${baseId}-category`}
            label="Category"
            value={category}
            options={["All categories", ...tourCategories]}
            onChange={setCategory}
          />
          <SelectField
            id={`${baseId}-duration`}
            label="Duration"
            value={duration}
            options={durations}
            onChange={setDuration}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Visual demo only. These filters do not check availability.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
          No demo tours match these filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tour) => (
              <li key={tour.id}>
                <Card
                  title={tour.destination}
                  description={tour.description}
                  media={<PlaceholderArt caption={tour.destination} tone={tour.tone} />}
                >
                  <dl className="grid gap-3 text-sm">
                    <Detail label="Destination" value={tour.destination} />
                    <Detail label="Duration" value={tour.duration} />
                    <Detail label="Category" value={tour.category} />
                    <Detail label="Starting price" value={formatTourPrice(tour.price)} />
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                      Demo tour
                    </p>
                    <Button className="mt-3" href={`/tours/${tour.id}`}>
                      View tour
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <select
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
