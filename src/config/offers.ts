import type { ArtTone } from "@/components/home/PlaceholderArt";

export type DemoOffer = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: string;
  validity: string;
  tone: ArtTone;
};

export const offerCategories = [
  "All categories",
  "Umrah",
  "Flights",
  "Hotels",
  "Tours",
  "Visa",
] as const;

export const demoOffers: readonly DemoOffer[] = [
  {
    id: "umrah-14",
    title: "Fourteen-night Umrah sample",
    category: "Umrah",
    description: "Demo promotion for a 14-night Makkah and Madinah outline.",
    price: "PKR 275,000 demo",
    validity: "Demo validity: 1 Oct 2026 – 31 Oct 2026",
    tone: "makkah",
  },
  {
    id: "umrah-10",
    title: "Ten-night Umrah sample",
    category: "Umrah",
    description: "Demo promotion for a 10-night family outline.",
    price: "PKR 310,000 demo",
    validity: "Demo validity: 1 Oct 2026 – 31 Oct 2026",
    tone: "hotel",
  },
  {
    id: "flight-jed",
    title: "Islamabad to Jeddah sample",
    category: "Flights",
    description: "Demo fare note. This is not a live ticket price.",
    price: "PKR 98,400 demo",
    validity: "Demo validity: 1 Oct 2026 – 15 Oct 2026",
    tone: "tour",
  },
  {
    id: "hotel-makkah",
    title: "Makkah stay sample",
    category: "Hotels",
    description: "Demo nightly stay note. No room is held.",
    price: "PKR 36,000 demo / night",
    validity: "Demo validity: 1 Nov 2026 – 30 Nov 2026",
    tone: "makkah",
  },
  {
    id: "tour-hunza",
    title: "Hunza outline sample",
    category: "Tours",
    description: "Demo tour promotion. This is not a departure.",
    price: "PKR 85,000 demo",
    validity: "Demo validity: 1 Oct 2026 – 31 Dec 2026",
    tone: "tour",
  },
  {
    id: "visa-uae",
    title: "UAE visit category sample",
    category: "Visa",
    description: "Demo fee label. This does not start an application.",
    price: "PKR 18,000 demo fee",
    validity: "Demo validity: 1 Oct 2026 – 31 Oct 2026",
    tone: "hotel",
  },
];

export function getDemoOffer(id: string) {
  return demoOffers.find((offer) => offer.id === id);
}
