import type { InquiryType } from "@/lib/inquiries";

export const travelServices = ["Flights", "Visa", "Umrah", "Tours"] as const;
export type TravelService = (typeof travelServices)[number];
export type TravelPreferences = {
  from: string;
  destination: string;
  departure: string;
  returning: string;
  trip: string;
  travellers: string;
  cabin: string;
  nights: string;
};
export type PreparedInquiry = {
  summary: string;
  type: InquiryType;
  destination: string;
  travelDate: string;
  travellers: string;
};

export function initialPreferences(service: TravelService): TravelPreferences {
  return {
    from: "",
    destination: service === "Umrah" ? "Makkah and Madinah" : "",
    departure: "",
    returning: "",
    trip: "One way",
    travellers: "1",
    cabin: "Economy",
    nights: "14",
  };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

/** Only travel preferences enter the summary. Contact details stay in the form. */
export function prepareTravelInquiry(
  service: TravelService,
  p: TravelPreferences,
  today: string,
):
  | { ok: true; inquiry: PreparedInquiry }
  | { ok: false; field: keyof TravelPreferences; message: string } {
  const fail = (field: keyof TravelPreferences, message: string) => ({
    ok: false as const,
    field,
    message,
  });
  if (!p.destination.trim() || p.destination.length > 160)
    return fail("destination", "Enter a destination of up to 160 characters.");
  if (service === "Flights" && (!p.from.trim() || p.from.length > 100))
    return fail("from", "Enter your departure city or airport.");
  if (
    service === "Flights" &&
    p.from.trim().toLowerCase() === p.destination.trim().toLowerCase()
  )
    return fail(
      "destination",
      "Choose a destination different from your departure.",
    );
  if (!validDate(p.departure) || p.departure < today)
    return fail("departure", "Choose a valid travel date from today onwards.");
  if (
    service === "Flights" &&
    p.trip === "Return" &&
    (!validDate(p.returning) || p.returning < p.departure)
  )
    return fail("returning", "Return date must be on or after departure.");
  if (!/^(?:[1-9]|[1-9]\d)$/.test(p.travellers))
    return fail("travellers", "Choose between 1 and 99 travellers.");
  if (
    service === "Umrah" &&
    (!/^\d{1,2}$/.test(p.nights) ||
      Number(p.nights) < 7 ||
      Number(p.nights) > 60)
  )
    return fail("nights", "Choose between 7 and 60 nights.");
  const parts = [
    `${service} inquiry`,
    `Destination ${p.destination.trim()}`,
    `Travel date ${p.departure}`,
    `Travellers ${p.travellers}`,
  ];
  if (service === "Flights") {
    parts.push(`From ${p.from.trim()}`, `Trip ${p.trip}`, `Cabin ${p.cabin}`);
    if (p.trip === "Return") parts.push(`Return ${p.returning}`);
    if (p.trip === "Multi-city")
      parts.push("Additional flight legs to discuss with the desk");
  }
  if (service === "Umrah")
    parts.push(
      `${p.nights} nights`,
      ...(p.from.trim() ? [`From ${p.from.trim()}`] : []),
    );
  return {
    ok: true,
    inquiry: {
      summary: parts.join(" · "),
      type:
        service === "Visa"
          ? "visa"
          : service === "Umrah"
            ? "umrah"
            : service === "Tours"
              ? "tour"
              : "contact",
      destination: p.destination.trim(),
      travelDate: p.departure,
      travellers: p.travellers,
    },
  };
}

export function whatsappLink(
  number: string,
  context = "I would like help planning a journey with Zayan Ahmed Travels.",
) {
  const digits = number.replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(context.slice(0, 1500))}`;
}

export function telephoneLink(number: string) {
  const digits = number.replace(/\D/g, "");
  if (!/^\d{7,15}$/.test(digits)) return "";
  return `tel:${number.trim().startsWith("+") ? "+" : ""}${digits}`;
}

export function publicTravelReference(value: unknown) {
  return typeof value === "string" &&
    /^\/(?:pages|umrah)\/[A-Za-z0-9_-]{1,80}$/.test(value)
    ? value
    : "";
}
