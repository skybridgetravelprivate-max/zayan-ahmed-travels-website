"use client";
import { useId, useState } from "react";
import Link from "next/link";
import type { PublicUmrahPackage } from "@/lib/public-umrah";

export function UmrahPackages({
  packages = [],
}: {
  packages?: readonly PublicUmrahPackage[];
}) {
  const id = useId();
  const [city, setCity] = useState("");
  const [duration, setDuration] = useState("");
  const visible = packages.filter(
    (p) =>
      (!city || p.departureCity === city) &&
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
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="font-semibold text-zayan-blue">
          No packages are currently published.
        </p>
        <p className="mt-3 text-muted">
          Our desk can prepare a quotation for your dates. Imported supplier
          drafts remain private until reviewed; sample prices and fictional
          hotel cards are not shown.
        </p>
        <Link
          className="mt-4 inline-block font-semibold text-zayan-blue underline"
          href="/umrah#plan"
        >
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
      <p role="status" className="my-4 text-sm text-muted">
        {visible.length} published packages match.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="min-w-0 rounded-2xl border border-line bg-surface p-6"
          >
            <h3 className="text-xl font-bold text-zayan-blue">{item.name}</h3>
            <p className="mt-3 text-muted">
              {item.departureCity} → {item.arrivalCity}
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
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
              className="mt-5 inline-block font-semibold text-zayan-blue underline"
              href={`/umrah/${encodeURIComponent(item.id)}`}
            >
              View package details
            </Link>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p>
          No published packages match. Change the filters or send an inquiry.
        </p>
      )}
    </div>
  );
}
