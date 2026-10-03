"use client";

import { useId, useMemo, useState } from "react";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { demoVisas, destinations, formatDemoFee, visaTypes } from "@/config/visa";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

export function VisaBoard() {
  const baseId = useId();
  const [destination, setDestination] = useState<string>(destinations[0]);
  const [visaType, setVisaType] = useState<string>(visaTypes[0]);

  const visible = useMemo(
    () =>
      demoVisas.filter((item) => {
        const destinationMatch =
          destination === "All destinations" || item.destination === destination;
        const typeMatch = visaType === "All types" || item.type === visaType;
        return destinationMatch && typeMatch;
      }),
    [destination, visaType],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            id={`${baseId}-destination`}
            label="Destination"
            value={destination}
            options={destinations}
            onChange={setDestination}
          />
          <SelectField
            id={`${baseId}-type`}
            label="Visa Type"
            value={visaType}
            options={visaTypes}
            onChange={setVisaType}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          Visual demo only. These filters do not check eligibility.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
          No demo visa categories match these filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
              <li key={item.id}>
                <Card
                  title={item.destination}
                  description={item.description}
                  media={<PlaceholderArt caption={item.destination} tone={item.tone} />}
                >
                  <dl className="grid gap-3 text-sm">
                    <Detail label="Visa type" value={item.type} />
                    <Detail label="Basic requirements" value={item.requirements} />
                    <Detail label="Demo fee" value={formatDemoFee(item.fee)} />
                  </dl>
                  <div className="mt-4">
                    <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                      Demo category
                    </p>
                    <Button className="mt-3" href={`/visa/${item.id}`}>
                      View visa
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
