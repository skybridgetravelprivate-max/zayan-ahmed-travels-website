"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { TravelIcon } from "@/components/ui/TravelIcon";
import { defaultWebsiteSettings } from "@/config/website";
import {
  initialPreferences,
  prepareTravelInquiry,
  travelServices,
  whatsappLink,
  publicTravelReference,
  type PreparedInquiry,
  type TravelPreferences,
  type TravelService,
} from "@/lib/travel-inquiry";

const icons = ["flight", "visa", "umrah", "tour"] as const;

export function SearchCard({
  title,
  initialService = "Flights",
  whatsapp = defaultWebsiteSettings.whatsapp,
  destination = "",
  reference = "",
  initialJourney,
}: {
  title?: string;
  initialService?: TravelService;
  whatsapp?: string;
  destination?: string;
  reference?: string;
  initialJourney?: Partial<
    Pick<TravelPreferences, "from" | "departure" | "nights">
  >;
}) {
  const id = useId();
  const [service, setService] = useState(initialService);
  const [preferences, setPreferences] = useState<
    Record<TravelService, TravelPreferences>
  >(
    () =>
      Object.fromEntries(
        travelServices.map((s) => [
          s,
          {
            ...initialPreferences(s),
            ...(s === initialService ? initialJourney : {}),
            ...(s === initialService && destination
              ? { destination: destination.slice(0, 160) }
              : {}),
          },
        ]),
      ) as Record<TravelService, TravelPreferences>,
  );
  const [prepared, setPrepared] = useState<PreparedInquiry | null>(null);
  const [error, setError] = useState("");
  const summary = useRef<HTMLHeadingElement>(null);
  const current = preferences[service];
  function change(name: keyof TravelPreferences, value: string) {
    setPreferences((all) => ({
      ...all,
      [service]: { ...all[service], [name]: value },
    }));
    setPrepared(null);
    setError("");
  }
  function select(next: TravelService) {
    setService(next);
    setPrepared(null);
    setError("");
  }
  function keys(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? travelServices.length - 1
          : (index + delta + travelServices.length) % travelServices.length;
    select(travelServices[next]);
    document.getElementById(`${id}-${next}`)?.focus();
  }
  function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const result = prepareTravelInquiry(service, current, today);
    if (!result.ok) {
      setError(result.message);
      e.currentTarget
        .querySelector<HTMLElement>(`[name="${result.field}"]`)
        ?.focus();
      return;
    }
    setError("");
    const publicPath = publicTravelReference(reference);
    const inquiry = publicPath
      ? {
          ...result.inquiry,
          summary: `${result.inquiry.summary} · Reference ${new URL(publicPath, window.location.origin).href}`,
        }
      : result.inquiry;
    setPrepared(inquiry);
    requestAnimationFrame(() => summary.current?.focus());
  }
  const input = (
    name: keyof TravelPreferences,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label className="travel-field">
      {label}
      <input
        name={name}
        type={type}
        value={current[name]}
        required={required}
        maxLength={name === "destination" ? 160 : 100}
        placeholder={
          type === "text"
            ? name === "from"
              ? "City or airport"
              : "City or destination"
            : undefined
        }
        onChange={(e) => change(name, e.target.value)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
    </label>
  );
  return (
    <section
      id="search"
      className="travel-search"
      aria-label={title || "Plan a travel inquiry"}
    >
      <div role="tablist" aria-label="Travel services" className="travel-tabs">
        {travelServices.map((s, i) => (
          <button
            key={s}
            type="button"
            role="tab"
            id={`${id}-${i}`}
            aria-selected={service === s}
            aria-controls={`${id}-panel`}
            tabIndex={service === s ? 0 : -1}
            onClick={() => select(s)}
            onKeyDown={(e) => keys(e, i)}
          >
            <TravelIcon name={icons[i]} />
            {s}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${travelServices.indexOf(service)}`}
        className="travel-search-panel"
      >
        <h2 className="sr-only">
          {title || `Plan your ${service.toLowerCase()} inquiry`}
        </h2>
        <form
          onSubmit={prepare}
          onInvalid={(e) => {
            const target = e.target as HTMLElement;
            const options = target.closest("details");
            if (options) options.open = true;
          }}
        >
          <div className="travel-fields">
            {service === "Flights" && input("from", "From", "text")}
            {input(
              "destination",
              service === "Flights"
                ? "To"
                : service === "Visa"
                  ? "Visa country"
                  : "Destination",
            )}
            {input("departure", "Travel date", "date")}
            {service === "Flights" &&
              current.trip === "Return" &&
              input("returning", "Return date", "date")}
            {service === "Umrah" && (
              <label className="travel-field">
                Nights
                <input
                  type="number"
                  name="nights"
                  min="7"
                  max="60"
                  required
                  value={current.nights}
                  onChange={(e) => change("nights", e.target.value)}
                />
              </label>
            )}
          </div>
          <details className="travel-options">
            <summary>
              Travellers
              {service === "Flights"
                ? ", cabin and trip type"
                : " and preferences"}
            </summary>
            <div className="travel-fields">
              <label className="travel-field">
                Travellers
                <input
                  type="number"
                  name="travellers"
                  min="1"
                  max="99"
                  required
                  value={current.travellers}
                  onChange={(e) => change("travellers", e.target.value)}
                />
              </label>
              {service === "Flights" && (
                <>
                  <label className="travel-field">
                    Trip type
                    <select
                      name="trip"
                      value={current.trip}
                      onChange={(e) => change("trip", e.target.value)}
                    >
                      <option>One way</option>
                      <option>Return</option>
                      <option>Multi-city</option>
                    </select>
                  </label>
                  <label className="travel-field">
                    Cabin
                    <select
                      name="cabin"
                      value={current.cabin}
                      onChange={(e) => change("cabin", e.target.value)}
                    >
                      <option>Economy</option>
                      <option>Premium economy</option>
                      <option>Business</option>
                      <option>First</option>
                    </select>
                  </label>
                </>
              )}
              {service === "Umrah" &&
                input("from", "Departure city", "text", false)}
            </div>
            {service === "Flights" && current.trip === "Multi-city" && (
              <p>
                Add the additional flight legs in your notes on the next step.
              </p>
            )}
          </details>
          <div className="travel-search-action">
            <span>Availability and prices confirmed by our desk.</span>
            <button type="submit" className="website-cta">
              Prepare inquiry <span aria-hidden="true">→</span>
            </button>
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="travel-error">
              {error}
            </p>
          )}
        </form>
        <div hidden={!prepared} className="travel-prepared">
          <h3 ref={summary} tabIndex={-1}>
            Review your inquiry
          </h3>
          <p className="travel-summary">{prepared?.summary}</p>
          <p>
            Share your contact details to request a quotation. Please leave
            payment details and identity documents out of this form.
          </p>
          <ServiceInquiryForm
            type={prepared?.type || "contact"}
            submitLabel="Send travel inquiry"
            context={prepared?.summary}
            details={prepared || undefined}
          />
          {prepared && whatsappLink(whatsapp, prepared.summary) && (
            <a
              className="travel-whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              href={whatsappLink(whatsapp, prepared.summary)}
            >
              Review in WhatsApp ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
