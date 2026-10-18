"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  demoHotels,
  formatNightlyPrice,
  hotelTypes,
  priceBands,
  starOptions,
} from "@/config/hotels";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-line bg-background px-3 py-2.5 text-sm focus:border-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue";

export function HotelSearch() {
  const baseId = useId();
  const [priceLabel, setPriceLabel] = useState<string>(priceBands[0].label);
  const [stars, setStars] = useState<string>(starOptions[0]);
  const [hotelType, setHotelType] = useState<string>(hotelTypes[0]);
  const [note, setNote] = useState<{ tone: "status" | "error"; message: string } | null>(null);

  const band = priceBands.find((item) => item.label === priceLabel) ?? priceBands[0];

  const visible = useMemo(
    () =>
      demoHotels.filter((hotel) => {
        const priceMatch = hotel.price >= band.min && hotel.price <= band.max;
        const starMatch = stars === "Any rating" || `${hotel.stars} stars` === stars;
        const typeMatch = hotelType === "All types" || hotel.type === hotelType;
        return priceMatch && starMatch && typeMatch;
      }),
    [band.max, band.min, hotelType, stars],
  );

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const city = String(data.get("city") ?? "").trim();
    const checkIn = String(data.get("checkin") ?? "").trim();
    const checkOut = String(data.get("checkout") ?? "").trim();

    if (!city) {
      setNote({ tone: "error", message: "Enter a destination city." });
      return;
    }
    if (!checkIn) {
      setNote({ tone: "error", message: "Enter a check-in date." });
      return;
    }
    if (!checkOut) {
      setNote({ tone: "error", message: "Enter a check-out date." });
      return;
    }
    if (checkOut < checkIn) {
      setNote({
        tone: "error",
        message: "Check-out date cannot be before check-in.",
      });
      return;
    }

    setNote({
      tone: "status",
      message: "This form does not check hotel availability. Contact us for current options.",
    });
  }

  return (
    <div className="space-y-8">
      <form
        className="rounded-3xl border border-line bg-surface p-4 shadow-xl sm:p-6"
        autoComplete="off"
        onSubmit={onSearch}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id={`${baseId}-city`} name="city" label="Destination / City" placeholder="Makkah" />
          <Field id={`${baseId}-checkin`} name="checkin" label="Check-in" type="date" />
          <Field id={`${baseId}-checkout`} name="checkout" label="Check-out" type="date" />
          <SelectField
            id={`${baseId}-rooms`}
            name="rooms"
            label="Rooms"
            options={["1", "2", "3", "4"]}
          />
          <SelectField
            id={`${baseId}-guests`}
            name="guests"
            label="Guests"
            options={["1", "2", "3", "4", "5", "6"]}
          />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            This button checks the destination and date fields in this browser
            only. It does not search live room availability or send details.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="outline">
              Check stay details
            </Button>
            <Button href="/contact">Open contact form</Button>
          </div>
        </div>
        {note ? (
          <p
            role={note.tone === "error" ? "alert" : "status"}
            className="mt-3 text-sm font-medium text-zayan-blue"
          >
            {note.message}
          </p>
        ) : null}
      </form>

      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zayan-blue">
          Filter sample hotels
        </h2>
        <p className="mt-1 text-sm text-muted">
          These filters only change the example cards below; they do not search
          current properties or rates.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <SelectField
            id={`${baseId}-price`}
            label="Price"
            value={priceLabel}
            options={priceBands.map((item) => item.label)}
            onChange={setPriceLabel}
          />
          <SelectField
            id={`${baseId}-stars`}
            label="Star Rating"
            value={stars}
            options={starOptions}
            onChange={setStars}
          />
          <SelectField
            id={`${baseId}-type`}
            label="Hotel Type"
            value={hotelType}
            options={hotelTypes}
            onChange={setHotelType}
          />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">
          Demo hotels
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Six sample stays. Nightly prices are not live rates.
        </p>
        {visible.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-surface px-6 py-8 text-sm text-muted">
            No demo hotels match these filters.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((hotel) => (
                <li key={hotel.id}>
                  <Card
                    title={hotel.name}
                    description={hotel.description}
                    media={<PlaceholderArt caption={hotel.name} tone={hotel.tone} />}
                  >
                    <dl className="grid gap-3 text-sm">
                      <Detail label="City" value={hotel.city} />
                      <Detail label="Star rating" value={`${hotel.stars} stars`} />
                      <Detail label="Amenities" value={hotel.amenities} />
                      <Detail label="Demo nightly price" value={formatNightlyPrice(hotel.price)} />
                    </dl>
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                        {hotel.type} · Demo stay
                      </p>
                      <Button href={`/hotels/${hotel.id}`}>View hotel</Button>
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
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        className={fieldClass}
      />
    </label>
  );
}

function SelectField({
  id,
  name,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  label: string;
  options: readonly string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const controlled = onChange !== undefined;

  return (
    <label htmlFor={id} className="block text-sm font-medium">
      {label}
      <select
        id={id}
        name={name ?? id}
        className={fieldClass}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : options[0]}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
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
