"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";

const services = ["Flights", "Hotels", "Umrah", "Visas", "Tours"] as const;

type Service = (typeof services)[number];

const descriptions: Record<Service, string> = {
  Flights:
    "This website does not search live flights, quote fares, or hold seats.",
  Hotels:
    "This website does not check room availability, quote rates, or reserve stays.",
  Umrah:
    "Current Umrah packages and prices are not listed on this page.",
  Visas:
    "Current visa service details are not listed on this page.",
  Tours:
    "Current itineraries and departure availability are not listed on this page.",
};

export function SearchCard() {
  const baseId = useId();
  const [service, setService] = useState<Service>("Flights");
  const panelId = `${baseId}-panel`;

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, item: Service) {
    const index = services.indexOf(item);
    let next = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % services.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + services.length) % services.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = services.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextService = services[next];
    setService(nextService);
    document.getElementById(`${baseId}-${nextService}`)?.focus();
  }

  return (
    <section
      id="search"
      aria-labelledby={`${baseId}-title`}
      className="scroll-mt-24 rounded-3xl border border-line bg-surface p-4 shadow-xl sm:p-6"
    >
      <h2 id={`${baseId}-title`} className="text-xl font-bold text-zayan-blue">
        Ask about a travel service
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Choose a service to see what this site can and cannot check. Choosing a
        service does not search, send an inquiry, hold availability, or make a
        booking.
      </p>

      <div
        role="tablist"
        aria-label="Travel services"
        className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {services.map((item) => {
          const selected = service === item;

          return (
            <button
              key={item}
              type="button"
              role="tab"
              id={`${baseId}-${item}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setService(item)}
              onKeyDown={(event) => onTabKey(event, item)}
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

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${baseId}-${service}`}
        className="mt-4 flex flex-col gap-4 rounded-2xl bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm leading-6 text-foreground">
          {descriptions[service]} Use the contact form to send an inquiry.
        </p>
        <Button href="/contact" className="shrink-0">
          Open contact form
        </Button>
      </div>
    </section>
  );
}
