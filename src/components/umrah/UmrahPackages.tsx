"use client";
import { useId, useState } from "react";
import Link from "next/link";
import type { PublicUmrahPackage } from "@/lib/public-umrah";
import { TravelIcon } from "@/components/ui/TravelIcon";

export function UmrahPackages({
  packages = [],
}: {
  packages?: readonly PublicUmrahPackage[];
}) {
  const id = useId();
  const [city, setCity] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const visible = packages.filter(
    (p) =>
      (!city || p.departureCity === city) &&
      (!category || p.packageType === category) &&
      (includePast || !p.departureDate || p.departureDate >= today) &&
      (!duration || p.durationDays === Number(duration)),
  );
  const cities = [
    ...new Set(packages.map((p) => p.departureCity).filter(Boolean)),
  ];
  const days = [
    ...new Set(
      packages
        .map((p) => p.durationDays)
        .filter((day): day is number => day !== null),
    ),
  ].sort((a, b) => a - b);
  if (!packages.length)
    return (
      <div className="travel-empty">
        <p className="font-semibold text-zayan-blue">
          An Umrah journey planned around you
        </p>
        <p className="mt-3 text-muted">
          Share your dates, departure city and room preferences. Our desk can
          prepare a current quotation with hotel, flight and transport details.
        </p>
        <Link className="website-cta" href="/umrah#plan">
          Prepare a personalised inquiry
        </Link>
      </div>
    );
  return (
    <div>
      <p className="text-sm text-muted">
        Filter the published catalogue below. This does not check live airline
        or hotel availability.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label htmlFor={`${id}-category`} className="font-semibold">
          Package category
          <select
            id={`${id}-category`}
            className="mt-2 w-full rounded-xl border border-line bg-white p-3"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {[
              ...new Set(packages.map((p) => p.packageType).filter(Boolean)),
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-city`} className="font-semibold">
          Departure city
          <select
            id={`${id}-city`}
            className="mt-2 w-full rounded-xl border border-line bg-white p-3"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            <option value="">All cities</option>
            {cities.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-duration`} className="font-semibold">
          Duration
          <select
            id={`${id}-duration`}
            className="mt-2 w-full rounded-xl border border-line bg-white p-3"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="">All durations</option>
            {days.map((value) => (
              <option key={value} value={value}>
                {value} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includePast}
          onChange={(e) => setIncludePast(e.target.checked)}
        />
        Include past departures
      </label>
      <p role="status" className="my-4 text-sm text-muted">
        {visible.length} published packages match.
      </p>
      <ul className="travel-catalogue-grid">
        {visible.map((item) => (
          <li key={item.id} className="travel-catalogue-card min-w-0">
            <div className="travel-card-art">
              <TravelIcon name="umrah" />
            </div>
            <div className="travel-card-body">
              <p className="text-xs font-bold uppercase">
                {item.packageType}
                {item.departureDate && item.departureDate < today
                  ? " · Past departure"
                  : ""}
              </p>
              <h3 className="text-xl font-bold text-zayan-blue">{item.name}</h3>
              <p className="mt-3 text-muted">
                {item.departureCity} → {item.arrivalCity}
              </p>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="text-muted">Travel dates</dt>
                  <dd>
                    {item.departureDate || "Confirm dates"}
                    {item.returnDate ? ` → ${item.returnDate}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Duration</dt>
                  <dd>
                    {item.durationDays === null
                      ? "Confirm with desk"
                      : `${item.durationDays} days`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Hotel nights</dt>
                  <dd>
                    Makkah: {item.makkahNights ?? "To confirm"} · Madinah:{" "}
                    {item.madinahNights ?? "To confirm"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Room type</dt>
                  <dd>{item.roomType || "To confirm"}</dd>
                </div>
              </dl>
              <Link
                className="website-cta mt-5"
                href={`/umrah/${encodeURIComponent(item.id)}`}
              >
                View package details
              </Link>
              <p className="text-xs">
                Request the current selling price and quotation validity.
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p role="status">
          No published packages match. Change the filters or send an inquiry.
        </p>
      )}
    </div>
  );
}
