"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { PlaceholderArt, type ArtTone } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  demoPackages,
  durations,
  formatPackagePrice,
  hotelCategories,
  priceBands,
} from "@/config/umrah";
import type { PublicUmrahPackage } from "@/lib/public-umrah";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

const artTones: ArtTone[] = ["makkah", "hotel", "tour"];

function included(value: boolean) {
  return value ? "Included" : "Not included";
}

function packageRows(item: PublicUmrahPackage) {
  const nights = item.durationDays === null ? "" : `${item.durationDays} nights`;
  return [
    ["Duration", nights],
    ["Package type", item.packageType],
    ["Departure city", item.departureCity],
    ["Arrival city", item.arrivalCity],
    ["Departure date", item.departureDate],
    ["Return date", item.returnDate],
    ["Makkah nights", item.makkahNights === null ? "" : String(item.makkahNights)],
    ["Madinah nights", item.madinahNights === null ? "" : String(item.madinahNights)],
    ["Room type", item.roomType],
    ["Transport", item.includesTransport === null ? "" : included(item.includesTransport)],
    ["Visa", item.includesVisa === null ? "" : included(item.includesVisa)],
    ["Meals", item.includesMeals === null ? "" : included(item.includesMeals)],
    ["Ziyarat", item.includesZiyarat === null ? "" : included(item.includesZiyarat)],
    ["Flight", item.flightInfo],
    ["Description", item.description],
  ].filter((row): row is [string, string] => row[1].length > 0);
}

export function UmrahPackages({ packages = [] }: { packages?: readonly PublicUmrahPackage[] }) {
  const live = packages.length > 0;
  const baseId = useId();
  const [duration, setDuration] = useState<string>(durations[0]);
  const [category, setCategory] = useState<string>(hotelCategories[0]);
  const [priceLabel, setPriceLabel] = useState<string>(priceBands[0].label);
  const [note, setNote] = useState("");

  const band = priceBands.find((item) => item.label === priceLabel) ?? priceBands[0];

  const visible = useMemo(
    () =>
      demoPackages.filter((item) => {
        const durationMatch = duration === "Any duration" || item.duration === duration;
        const categoryMatch = category === "Any category" || item.category === category;
        const priceMatch = item.price >= band.min && item.price <= band.max;
        return durationMatch && categoryMatch && priceMatch;
      }),
    [band.max, band.min, category, duration],
  );

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNote(
      "Demo search only. Departure city and travel month are not used to filter live or demo packages. These packages are samples and nothing is reserved.",
    );
  }

  return (
    <div className="space-y-8">
      <form
        className="rounded-3xl border border-line bg-surface p-4 shadow-xl sm:p-6"
        autoComplete="off"
        onSubmit={onSearch}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${baseId}-city`} label="Departure city" placeholder="Islamabad" />
          <Field id={`${baseId}-month`} label="Travel month" type="month" />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            Visual demo only. Nothing is searched or booked.
          </p>
          <Button type="submit">Search</Button>
        </div>
        {note ? (
          <p role="status" className="mt-3 text-sm font-medium text-zayan-blue">
            {note}
          </p>
        ) : null}
      </form>

      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <SelectField
            id={`${baseId}-duration`}
            label="Duration"
            value={duration}
            options={durations}
            onChange={setDuration}
          />
          <SelectField
            id={`${baseId}-category`}
            label="Hotel Category"
            value={category}
            options={hotelCategories}
            onChange={setCategory}
          />
          <SelectField
            id={`${baseId}-price`}
            label="Price"
            value={priceLabel}
            options={priceBands.map((item) => item.label)}
            onChange={setPriceLabel}
          />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">
          {live ? "Umrah packages" : "Demo Umrah packages"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {live
            ? "Published packages. Prices are not shown here, and nothing is reserved."
            : "Six sample packages. These are not live CRM packages. Hotels, transport, and prices are not live."}
        </p>
        {live ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((item, index) => {
              const rows = packageRows(item);
              const summary = rows
                .filter(([label]) => label === "Duration" || label === "Package type")
                .map(([, value]) => value)
                .join(" · ");

              return (
                <li key={item.id}>
                  <Card
                    title={item.name}
                    description={summary || "Published package"}
                    media={<PlaceholderArt caption={item.name} tone={artTones[index % artTones.length] ?? "makkah"} />}
                  >
                    <dl className="grid gap-3 text-sm">
                      {rows.map(([label, value]) => (
                        <Detail key={label} label={label} value={value} />
                      ))}
                    </dl>
                    <div className="mt-4">
                      <Button href={`/umrah/${item.id}`}>View package</Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : visible.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
            No demo packages match these filters.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
                <li key={item.id}>
                  <Card
                    title={item.name}
                    description={`${item.duration} · ${item.category}`}
                    media={<PlaceholderArt caption={item.name} tone={item.tone} />}
                  >
                    <dl className="grid gap-3 text-sm">
                      <Detail label="Duration" value={item.duration} />
                      <Detail label="Makkah hotel" value={item.makkahHotel} />
                      <Detail label="Madinah hotel" value={item.madinahHotel} />
                      <Detail label="Transport" value={item.transport} />
                      <Detail label="Visa" value={item.visa} />
                      <Detail label="Price" value={formatPackagePrice(item.price)} />
                    </dl>
                    <div className="mt-4">
                      <Button href={`/umrah/${item.id}`}>View package</Button>
                    </div>
                  </Card>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <input id={id} name={id} type={type} placeholder={placeholder} className={fieldClass} />
    </label>
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
