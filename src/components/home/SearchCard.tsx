"use client";
import { useId, useState, type KeyboardEvent, type FormEvent } from "react";
import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
const services = ["Flights", "Hotels", "Umrah", "Tours"] as const;
const field =
  "mt-1.5 min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
export function SearchCard({ title }: { title?: string }) {
  const id = useId();
  const [service, setService] = useState<(typeof services)[number]>("Flights");
  const [trip, setTrip] = useState("One way");
  const [context, setContext] = useState("");
  function keys(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? services.length - 1
          : (index + delta + services.length) % services.length;
    if (!delta && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setService(services[next]);
    setContext("");
    document.getElementById(`${id}-${next}`)?.focus();
  }
  function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const departure = String(d.get("departure"));
    const returning = String(d.get("return") || "");
    if (returning && returning < departure) {
      e.currentTarget
        .querySelector<HTMLInputElement>('[name="return"]')
        ?.setCustomValidity("Return date must follow departure");
      e.currentTarget.reportValidity();
      return;
    }
    setContext(
      `${service} inquiry. ${trip}. From: ${d.get("from") || "Not specified"}. Destination: ${d.get("to")}. Departure/check-in: ${departure}. Return/check-out: ${returning || "Not specified"}. Travellers: ${d.get("travellers")}. Class: ${d.get("class") || "Not specified"}.`,
    );
  }
  return (
    <section
      id="search"
      aria-label={title || "Plan a travel inquiry"}
      className="overflow-hidden rounded-2xl border border-line bg-white shadow-xl"
    >
      <div
        role="tablist"
        aria-label="Travel services"
        className="grid grid-cols-4 bg-sky-50"
      >
        {services.map((s, i) => (
          <button
            type="button"
            role="tab"
            id={`${id}-${i}`}
            aria-selected={service === s}
            aria-controls={`${id}-panel`}
            tabIndex={service === s ? 0 : -1}
            key={s}
            onClick={() => {
              setService(s);
              setContext("");
            }}
            onKeyDown={(e) => keys(e, i)}
            className={`min-h-12 px-2 py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-zayan-orange ${service === s ? "bg-zayan-blue text-white" : "text-zayan-blue"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${services.indexOf(service)}`}
        className="p-5 sm:p-6"
      >
        <h2 className="text-lg font-bold text-zayan-blue">
          Plan your {service.toLowerCase()} inquiry
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Share preferences first, then your contact details. This is an
          inquiry, not a live availability search or booking.
        </p>
        <form
          onSubmit={prepare}
          onInput={(event) => {
            event.currentTarget.querySelector<HTMLInputElement>('[name="return"]')?.setCustomValidity("");
            if (context) setContext("");
          }}
          onChange={(event) => {
            if (event.target instanceof HTMLInputElement && ["departure", "return"].includes(event.target.name)) {
              event.currentTarget.querySelector<HTMLInputElement>('[name="return"]')?.setCustomValidity("");
            }
            if (context) setContext("");
          }}
          className="mt-4"
        >
          <fieldset className="mb-4 flex flex-wrap gap-5">
            <legend className="sr-only">Trip type</legend>
            {["One way", "Return", "Multi-city"].map((t) => (
              <label
                key={t}
                className="flex min-h-8 items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="trip"
                  value={t}
                  checked={trip === t}
                  onChange={() => {
                    setTrip(t);
                    setContext("");
                  }}
                />
                {t}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {service === "Flights" && (
              <label className="text-xs font-medium">
                From
                <input
                  className={field}
                  name="from"
                  placeholder="City or airport"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label className="text-xs font-medium">
              {service === "Flights" ? "To" : "Destination"}
              <input
                className={field}
                name="to"
                placeholder="City or destination"
                required
                maxLength={100}
              />
            </label>
            <label className="text-xs font-medium">
              {service === "Hotels" ? "Check-in" : "Departure"}
              <input className={field} name="departure" type="date" required />
            </label>
            {(trip === "Return" || service === "Hotels") && (
              <label className="text-xs font-medium">
                {service === "Hotels" ? "Check-out" : "Return"}
                <input
                  className={field}
                  name="return"
                  type="date"
                  required
                  onChange={(e) => e.target.setCustomValidity("")}
                />
              </label>
            )}
            <label className="text-xs font-medium">
              Travellers
              <select className={field} name="travellers">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "traveller" : "travellers"}
                  </option>
                ))}
              </select>
            </label>
            {service === "Flights" && (
              <label className="text-xs font-medium">
                Class
                <select className={field} name="class">
                  <option>Economy</option>
                  <option>Premium economy</option>
                  <option>Business</option>
                  <option>First</option>
                </select>
              </label>
            )}
            <button className="website-cta self-end" type="submit">
              Prepare inquiry →
            </button>
          </div>
          {trip === "Multi-city" && (
            <p className="mt-3 text-sm text-muted">
              Add all legs in the message on the next step.
            </p>
          )}
        </form>
        {
          <div
            hidden={!context}
            className="mt-6 rounded-xl bg-zayan-blue p-5 text-white"
          >
            <h3 className="text-xl font-bold">
              Send your requirements to our desk
            </h3>
            <p className="my-3 text-sm leading-6 text-white/85">{context}</p>
            <ServiceInquiryForm
              type={
                service === "Umrah"
                  ? "umrah"
                  : service === "Tours"
                    ? "tour"
                    : "contact"
              }
              submitLabel="Send travel inquiry"
              context={context}
            />
          </div>
        }
      </div>
    </section>
  );
}
