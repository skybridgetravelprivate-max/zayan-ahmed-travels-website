"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  demoTickets,
  formatDemoTicketPrice,
  ticketCabinClasses,
  ticketTripTypes,
  type TicketTripType,
} from "@/config/tickets";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue disabled:cursor-not-allowed disabled:bg-background/70";

export function TicketSearch() {
  const baseId = useId();
  const [trip, setTrip] = useState<TicketTripType>("Round Trip");
  const [notice, setNotice] = useState<{ tone: "status" | "error"; message: string } | null>(
    null,
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
    if (trip === "Round Trip" && depart && returnDate && returnDate < depart) {
      setNotice({
        tone: "error",
        message: "Return date cannot be before departure.",
      });
      return;
    }

    setNotice({
      tone: "status",
      message:
        "Demo search only. From, To, dates, travellers, and cabin are not used for live ticket availability. These cards are samples and no seats are checked.",
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
          {ticketTripTypes.map((item) => {
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
          <Field id={`${baseId}-depart`} name="depart" label="Departure date" type="date" />
          <Field
            id={`${baseId}-return`}
            name="return"
            label="Return date"
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
            Cabin class
            <select id={`${baseId}-cabin`} name="cabin" className={fieldClass} defaultValue="Economy">
              {ticketCabinClasses.map((cabin) => (
                <option key={cabin}>{cabin}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            Visual demo only. Nothing is searched or booked.
            {trip !== "Round Trip" ? " Return is unused for One Way." : ""}
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

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Demo ticket results</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Three sample tickets. Prices are not live fares and seats are not held.
        </p>
        <ul className="mt-6 grid gap-4">
          {demoTickets.map((ticket) => (
            <li key={ticket.id}>
              <Card title={ticket.carrier} description={`${ticket.from} – ${ticket.to}`}>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Detail label="Departure" value={`${ticket.depart} · ${ticket.from}`} />
                  <Detail label="Arrival" value={`${ticket.arrive} · ${ticket.to}`} />
                  <Detail label="Duration" value={ticket.duration} />
                  <Detail label="Cabin" value={ticket.cabin} />
                  <Detail label="Price" value={formatDemoTicketPrice(ticket.price)} />
                </dl>
                <p className="mt-4 text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                  Demo ticket · Sample only
                </p>
              </Card>
            </li>
          ))}
        </ul>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
