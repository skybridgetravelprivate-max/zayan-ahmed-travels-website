"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";

const tabs = ["Flights", "Hotels", "Umrah", "Visa", "Tours"] as const;

type Tab = (typeof tabs)[number];

type Field = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  options?: readonly string[];
};

const forms: Record<Tab, { action: string; fields: readonly Field[] }> = {
  Flights: {
    action: "Search flights",
    fields: [
      { name: "from", label: "From", placeholder: "Islamabad" },
      { name: "to", label: "To", placeholder: "Jeddah" },
      { name: "depart", label: "Depart", type: "date" },
      { name: "return", label: "Return", type: "date" },
      { name: "passengers", label: "Passengers", type: "number" },
    ],
  },
  Hotels: {
    action: "Search hotels",
    fields: [
      { name: "city", label: "City", placeholder: "Makkah" },
      { name: "checkin", label: "Check in", type: "date" },
      { name: "checkout", label: "Check out", type: "date" },
      { name: "guests", label: "Guests", type: "number" },
    ],
  },
  Umrah: {
    action: "View Umrah demo",
    fields: [
      { name: "city", label: "Departure city", placeholder: "Islamabad" },
      { name: "month", label: "Travel month", type: "month" },
      {
        name: "length",
        label: "Sample length",
        options: ["7 nights", "10 nights", "14 nights"],
      },
    ],
  },
  Visa: {
    action: "View visa demo",
    fields: [
      {
        name: "destination",
        label: "Destination",
        options: ["Saudi", "UAE", "UK", "Schengen", "Turkey"],
      },
      { name: "nationality", label: "Nationality", placeholder: "Pakistan" },
      { name: "travel", label: "Travel date", type: "date" },
    ],
  },
  Tours: {
    action: "View tours demo",
    fields: [
      { name: "destination", label: "Destination", placeholder: "Hunza" },
      { name: "depart", label: "Departure", type: "date" },
      { name: "travellers", label: "Travellers", type: "number" },
    ],
  },
};

export function SearchCard() {
  const baseId = useId();
  const [tab, setTab] = useState<Tab>("Flights");
  const [note, setNote] = useState("");
  const form = forms[tab];
  const panelId = `${baseId}-panel`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNote("Demo only. This form does not send a request.");
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, item: Tab) {
    const index = tabs.indexOf(item);
    let next = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[next];
    setTab(nextTab);
    setNote("");
    document.getElementById(`${baseId}-${nextTab}`)?.focus();
  }

  return (
    <div
      id="search"
      className="scroll-mt-24 rounded-3xl border border-line bg-surface p-4 shadow-xl sm:p-6"
    >
      <div
        role="tablist"
        aria-label="Search category"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {tabs.map((item) => {
          const selected = tab === item;

          return (
            <button
              key={item}
              type="button"
              role="tab"
              id={`${baseId}-${item}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setTab(item);
                setNote("");
              }}
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

      <form className="mt-5" autoComplete="off" onSubmit={onSubmit}>
        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${baseId}-${tab}`}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {form.fields.map((field) => {
            const fieldId = `${baseId}-${tab}-${field.name}`;

            return (
              <label
                key={field.name}
                htmlFor={fieldId}
                className="block text-sm font-medium text-foreground"
              >
                {field.label}
                {field.options ? (
                  <select
                    id={fieldId}
                    name={field.name}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
                    defaultValue={field.options[0]}
                  >
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={fieldId}
                    name={field.name}
                    type={field.type ?? "text"}
                    placeholder={field.placeholder}
                    min={field.type === "number" ? 1 : undefined}
                    className="mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm placeholder:text-muted/70 focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue"
                  />
                )}
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            Visual demo only. Nothing is searched or booked.
          </p>
          <Button type="submit">{form.action}</Button>
        </div>
        {note ? (
          <p role="status" className="mt-3 text-sm font-medium text-zayan-blue">
            {note}
          </p>
        ) : null}
      </form>
    </div>
  );
}
