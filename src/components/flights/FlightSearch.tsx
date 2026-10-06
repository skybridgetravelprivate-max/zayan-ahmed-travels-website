"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  cabinClasses,
  demoFlights,
  formatDemoPrice,
  priceBands,
  tripTypes,
  type TripType,
} from "@/config/flights";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue disabled:cursor-not-allowed disabled:bg-background/70";

export function FlightSearch() {
  const baseId = useId();
  const [trip, setTrip] = useState<TripType>("Round Trip");
  const [airline, setAirline] = useState<string>("All airlines");
  const [stops, setStops] = useState<string>("Any stops");
  const [priceLabel, setPriceLabel] = useState<string>(priceBands[0].label);
  const [notice, setNotice] = useState<{ tone: "status" | "error"; message: string } | null>(
    null,
  );

  const airlines = ["All airlines", ...demoFlights.map((flight) => flight.airline)];
  const stopOptions = ["Any stops", "Non-stop", "1 stop", "2 stops"];
  const band = priceBands.find((item) => item.label === priceLabel) ?? priceBands[0];

  const visible = useMemo(
    () =>
      demoFlights.filter((flight) => {
        const airlineMatch = airline === "All airlines" || flight.airline === airline;
        const stopsMatch = stops === "Any stops" || flight.stops === stops;
        const priceMatch = flight.price >= band.min && flight.price <= band.max;
        return airlineMatch && stopsMatch && priceMatch;
      }),
    [airline, band.max, band.min, stops],
  );

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("from") ?? "").trim();
    const to = String(data.get("to") ?? "").trim();
    const depart = String(data.get("depart") ?? "").trim();
    const returnDate = String(data.get("return") ?? "").trim();

    if (!from) {
      setNotice({ tone: "error", message: "Enter a From city." });
      return;
    }
    if (!to) {
      setNotice({ tone: "error", message: "Enter a To city." });
      return;
    }
    if (!depart) {
      setNotice({ tone: "error", message: "Enter a departure date." });
      return;
    }
    if (trip === "Round Trip" && !returnDate) {
      setNotice({ tone: "error", message: "Enter a return date." });
      return;
    }
    if (trip === "Round Trip" && returnDate < depart) {
      setNotice({
        tone: "error",
        message: "Return date cannot be before departure.",
      });
      return;
    }

    setNotice({
      tone: "status",
      message: "This form does not check live flight availability. Contact us for current options.",
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="rounded-3xl border border-line bg-surface p-4 shadow-xl sm:p-6"
        autoComplete="off"
        onSubmit={onSearch}
      >
        <div role="group" aria-label="Trip type" className="flex gap-2 overflow-x-auto">
          {tripTypes.map((item) => {
            const selected = trip === item;

            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTrip(item);
                  setNotice(null);
                }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue ${
                  selected
                    ? "bg-zayan-blue text-white"
                    : "bg-background text-foreground hover:text-zayan-blue"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id={`${baseId}-from`} name="from" label="From" placeholder="Islamabad" />
          <Field id={`${baseId}-to`} name="to" label="To" placeholder="Jeddah" />
          <Field id={`${baseId}-depart`} name="depart" label="Departure" type="date" />
          <Field
            id={`${baseId}-return`}
            name="return"
            label="Return"
            type="date"
            disabled={trip !== "Round Trip"}
          />
          <label htmlFor={`${baseId}-travellers`} className="block text-sm font-medium">
            Travellers
            <select id={`${baseId}-travellers`} name="travellers" className={fieldClass} defaultValue="1">
              {["1", "2", "3", "4", "5", "6"].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${baseId}-cabin`} className="block text-sm font-medium">
            Cabin Class
            <select id={`${baseId}-cabin`} name="cabin" className={fieldClass} defaultValue="Economy">
              {cabinClasses.map((cabin) => (
                <option key={cabin}>{cabin}</option>
              ))}
            </select>
          </label>
        </div>

        {trip === "Multi City" ? (
          <fieldset className="mt-5 rounded-2xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-zayan-blue">
              Second city pair
            </legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field id={`${baseId}-from-2`} label="From" placeholder="Jeddah" />
              <Field id={`${baseId}-to-2`} label="To" placeholder="Islamabad" />
              <Field id={`${baseId}-depart-2`} label="Departure" type="date" />
            </div>
          </fieldset>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            For current flight availability and booking assistance, contact us.
            {trip !== "Round Trip" ? " Return is unused for this trip type." : ""}
          </p>
          <Button type="submit">Search</Button>
        </div>
        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className="mt-3 text-sm font-medium text-zayan-blue"
          >
            {notice.message}
          </p>
        ) : null}
      </form>

      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FilterSelect
            id={`${baseId}-airline`}
            label="Airline"
            value={airline}
            options={airlines}
            onChange={setAirline}
          />
          <FilterSelect
            id={`${baseId}-stops`}
            label="Stops"
            value={stops}
            options={stopOptions}
            onChange={setStops}
          />
          <FilterSelect
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
          Demo flight results
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Three sample Islamabad to Jeddah options. Prices are not live fares.
        </p>
        {visible.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
            No demo flights match these filters.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {visible.map((flight) => (
                <li key={flight.id}>
                  <Card
                    title={flight.airline}
                    description={`${flight.from} – ${flight.to}`}
                  >
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <Detail label="Departure" value={`${flight.depart} · ${flight.from}`} />
                      <Detail label="Arrival" value={`${flight.arrive} · ${flight.to}`} />
                      <Detail label="Duration" value={flight.duration} />
                      <Detail label="Stops" value={flight.stops} />
                      <Detail label="Baggage" value={flight.baggage} />
                      <Detail label="Price" value={formatDemoPrice(flight.price)} />
                    </dl>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                        Demo fare
                      </p>
                      <Button href={`/flights/${flight.id}`}>View flight</Button>
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
  name,
  label,
  type = "text",
  placeholder,
  disabled = false,
}: {
  id: string;
  name?: string;
  label: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <input
        id={id}
        name={name ?? id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldClass}
      />
    </label>
  );
}

function FilterSelect({
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
