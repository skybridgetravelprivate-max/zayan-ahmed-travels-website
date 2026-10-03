"use client";

import { useMemo, useState } from "react";
import { AccountState } from "@/components/account/AccountState";
import { BookingStatusBadge } from "@/components/account/BookingStatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { bookingTabs, type BookingStatus } from "@/config/account";
import type { AccountBooking } from "@/lib/account-bookings";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

export function BookingList({
  bookings,
  status = "ready",
}: {
  bookings: readonly AccountBooking[];
  status?: "ready" | "loading" | "error";
}) {
  const [tab, setTab] = useState<(typeof bookingTabs)[number]>("All");
  const [query, setQuery] = useState("");
  const [service, setService] = useState<string>("All services");
  const [openId, setOpenId] = useState<string | null>(null);

  const services = ["All services", ...new Set(bookings.map((item) => item.service))];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return bookings.filter((booking) => {
      const tabMatch = tab === "All" || booking.status === (tab as BookingStatus);
      const serviceMatch = service === "All services" || booking.service === service;
      const queryMatch =
        needle.length === 0 ||
        booking.reference.toLowerCase().includes(needle) ||
        booking.destination.toLowerCase().includes(needle) ||
        booking.service.toLowerCase().includes(needle);
      return tabMatch && serviceMatch && queryMatch;
    });
  }, [bookings, query, service, tab]);

  if (status === "loading") {
    return (
      <AccountState
        status="loading"
        title="Loading bookings"
        message="Fetching bookings for the signed-in account."
      />
    );
  }

  if (status === "error") {
    return (
      <AccountState
        status="error"
        title="Bookings temporarily unavailable"
        message="Bookings could not be loaded right now. Try again shortly."
      />
    );
  }

  if (bookings.length === 0) {
    return (
      <AccountState
        status="empty"
        title="No bookings yet"
        message="Trips you book later will appear here. Sample bookings are not part of this account."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor="booking-search" className="block text-sm font-medium">
            Search
            <input
              id="booking-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Reference or destination"
              className={fieldClass}
            />
          </label>
          <label htmlFor="booking-service" className="block text-sm font-medium">
            Service
            <select
              id="booking-service"
              value={service}
              onChange={(event) => setService(event.target.value)}
              className={fieldClass}
            >
              {services.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Filters apply to bookings already loaded for this signed-in account.
        </p>
      </div>

      <div role="group" aria-label="Booking status" className="flex gap-2 overflow-x-auto">
        {bookingTabs.map((item) => {
          const selected = tab === item;

          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => setTab(item)}
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

      {visible.length === 0 ? (
        <AccountState
          status="empty"
          title="No matching bookings"
          message="Nothing in your booking list matches this search or tab."
        />
      ) : (
        <ul className="grid gap-4">
          {visible.map((booking) => {
            const open = openId === booking.reference;

            return (
              <li key={booking.reference}>
                <Card
                  title={booking.reference}
                  description={`${booking.service} · ${booking.destination}`}
                  className={open ? "ring-2 ring-zayan-orange" : ""}
                >
                  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Booking reference" value={booking.reference} />
                    <Detail label="Service type" value={booking.service} />
                    <Detail label="Destination" value={booking.destination} />
                    <Detail label="Travel date" value={booking.travelDate} />
                  </dl>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <BookingStatusBadge status={booking.status} />
                    <Button
                      variant={open ? "secondary" : "primary"}
                      aria-pressed={open}
                      onClick={() => setOpenId(open ? null : booking.reference)}
                    >
                      View details
                    </Button>
                  </div>
                  {open ? (
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <Detail label="Created" value={formatDisplayDate(booking.createdAt)} />
                      <Detail label="Updated" value={formatDisplayDate(booking.updatedAt)} />
                    </dl>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatDisplayDate(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
