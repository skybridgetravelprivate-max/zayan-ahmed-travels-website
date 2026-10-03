import type { ArtTone } from "@/components/home/PlaceholderArt";

export const tourCategories = [
  "Pakistan",
  "International",
  "Family",
  "Honeymoon",
  "Group",
] as const;

export type TourCategory = (typeof tourCategories)[number];

export type DemoTour = {
  id: string;
  destination: string;
  duration: string;
  category: TourCategory;
  description: string;
  price: number;
  tone: ArtTone;
};

export const demoTours: readonly DemoTour[] = [
  {
    id: "hunza",
    destination: "Hunza",
    duration: "5 days",
    category: "Pakistan",
    description: "Demo outline of a Hunza valley visit. This is not a departure.",
    price: 85000,
    tone: "tour",
  },
  {
    id: "skardu",
    destination: "Skardu",
    duration: "7 days",
    category: "Pakistan",
    description: "Demo outline of lakes and valleys around Skardu. This is not a departure.",
    price: 120000,
    tone: "hotel",
  },
  {
    id: "istanbul",
    destination: "Istanbul",
    duration: "4 days",
    category: "International",
    description: "Demo city outline for Istanbul. This is not a departure.",
    price: 180000,
    tone: "makkah",
  },
  {
    id: "dubai-family",
    destination: "Dubai",
    duration: "5 days",
    category: "Family",
    description: "Demo family break in Dubai with open time. This is not a departure.",
    price: 210000,
    tone: "tour",
  },
  {
    id: "maldives",
    destination: "Maldives",
    duration: "6 days",
    category: "Honeymoon",
    description: "Demo honeymoon stay outline. This is not a departure.",
    price: 350000,
    tone: "hotel",
  },
  {
    id: "northern-group",
    destination: "Gilgit",
    duration: "8 days",
    category: "Group",
    description: "Demo group circuit in northern Pakistan. This is not a departure.",
    price: 95000,
    tone: "makkah",
  },
];

export const destinations = [
  "All destinations",
  ...demoTours.map((tour) => tour.destination),
] as const;

export const durations = [
  "Any duration",
  "4 days",
  "5 days",
  "6 days",
  "7 days",
  "8 days",
] as const;

export function getDemoTour(id: string) {
  return demoTours.find((tour) => tour.id === id);
}

export function formatTourPrice(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo`;
}
