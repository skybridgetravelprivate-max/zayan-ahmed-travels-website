export const umrahPackages = [
  {
    title: "Fourteen-night demo plan",
    description:
      "Sample Makkah and Madinah stay with an Islamabad departure. Not a live package.",
    tone: "makkah",
    detail: "Demo package",
  },
  {
    title: "Ten-night family demo plan",
    description:
      "A slower sample visit with shared transfers between the two cities. Not a live package.",
    tone: "hotel",
    detail: "Demo package",
  },
  {
    title: "Seven-night express demo plan",
    description:
      "A shorter sample Umrah outline for a tighter schedule. Not a live package.",
    tone: "tour",
    detail: "Demo package",
  },
] as const;

export const flightRoutes = [
  { from: "Islamabad", to: "Jeddah" },
  { from: "Islamabad", to: "Riyadh" },
  { from: "Islamabad", to: "Dubai" },
  { from: "Islamabad", to: "London" },
] as const;

export const hotels = [
  {
    title: "Makkah sample stay",
    description:
      "Demo hotel card for a central Makkah area. No room is held and no rate is live.",
    tone: "makkah",
    detail: "Demo stay",
  },
  {
    title: "Madinah sample stay",
    description:
      "Demo hotel card near the Prophet's Mosque area. No room is held and no rate is live.",
    tone: "hotel",
    detail: "Demo stay",
  },
  {
    title: "Dubai marina sample stay",
    description:
      "Demo hotel card for a Dubai city break. No room is held and no rate is live.",
    tone: "tour",
    detail: "Demo stay",
  },
] as const;

export const visaServices = [
  {
    title: "Saudi",
    description:
      "Demo service card for Saudi visit and Umrah travel documents.",
  },
  {
    title: "UAE",
    description: "Demo service card for UAE entry documents.",
  },
  {
    title: "UK",
    description: "Demo service card for United Kingdom visit documents.",
  },
  {
    title: "Schengen",
    description: "Demo service card for Schengen-area visit documents.",
  },
  {
    title: "Turkey",
    description: "Demo service card for Turkey travel documents.",
  },
] as const;

export const tours = [
  {
    title: "Hunza and Skardu sample",
    description:
      "Demo tour of northern Pakistan valleys over several sample days. Not a departure.",
    tone: "tour",
    detail: "Demo tour",
  },
  {
    title: "Istanbul sample city tour",
    description:
      "Demo four-day city outline covering historic quarters and free time. Not a departure.",
    tone: "hotel",
    detail: "Demo tour",
  },
  {
    title: "Dubai and Abu Dhabi sample",
    description:
      "Demo two-city outline with time left open for the traveller. Not a departure.",
    tone: "makkah",
    detail: "Demo tour",
  },
] as const;

export const reasons = [
  {
    title: "One travel desk",
    description:
      "Flights, hotels, Umrah, visas, and tours can be planned in the same conversation.",
  },
  {
    title: "Plain explanations",
    description:
      "Options are described in everyday language before a traveller decides.",
  },
  {
    title: "Umrah as a specialty",
    description:
      "Pilgrimage trips are planned with the same care as the rest of the journey.",
  },
  {
    title: "Follow-through",
    description:
      "The same travel desk stays with the plan from the first question to departure.",
  },
] as const;

export const testimonials = [
  {
    name: "Hina R.",
    quote:
      "We compared two Umrah lengths and understood the difference before deciding.",
  },
  {
    name: "Omar S.",
    quote:
      "The Islamabad to Jeddah route was explained together with the hotel stay.",
  },
  {
    name: "Fatima N.",
    quote:
      "Questions about a family UAE trip were answered without a hard sell.",
  },
] as const;
