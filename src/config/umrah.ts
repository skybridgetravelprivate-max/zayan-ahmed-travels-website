import type { ArtTone } from "@/components/home/PlaceholderArt";

export type HotelCategory = "Economy" | "Standard" | "Premium";

export type DemoPackage = {
  id: string;
  name: string;
  duration: "7 nights" | "10 nights" | "14 nights";
  makkahHotel: string;
  madinahHotel: string;
  transport: string;
  visa: string;
  price: number;
  category: HotelCategory;
  tone: ArtTone;
};

export const demoPackages: readonly DemoPackage[] = [
  {
    id: "express-7",
    name: "Seven-night express demo",
    duration: "7 nights",
    makkahHotel: "Haram Side House",
    madinahHotel: "Quba Lane Stay",
    transport: "Shared coach",
    visa: "Visa guidance included",
    price: 185000,
    category: "Economy",
    tone: "makkah",
  },
  {
    id: "comfort-7",
    name: "Seven-night comfort demo",
    duration: "7 nights",
    makkahHotel: "Noor Court",
    madinahHotel: "Ansar Sample Stay",
    transport: "Shared coach",
    visa: "Visa guidance included",
    price: 245000,
    category: "Standard",
    tone: "hotel",
  },
  {
    id: "family-10",
    name: "Ten-night family demo",
    duration: "10 nights",
    makkahHotel: "Noor Court",
    madinahHotel: "Quba House",
    transport: "Private transfer",
    visa: "Visa guidance included",
    price: 310000,
    category: "Standard",
    tone: "tour",
  },
  {
    id: "premium-10",
    name: "Ten-night premium demo",
    duration: "10 nights",
    makkahHotel: "Makkah Gate Sample",
    madinahHotel: "Rawdah View Sample",
    transport: "Private transfer",
    visa: "Visa guidance included",
    price: 420000,
    category: "Premium",
    tone: "makkah",
  },
  {
    id: "calm-14",
    name: "Fourteen-night calm demo",
    duration: "14 nights",
    makkahHotel: "Haram Side House",
    madinahHotel: "Ansar Sample Stay",
    transport: "Shared coach",
    visa: "Visa guidance included",
    price: 275000,
    category: "Economy",
    tone: "hotel",
  },
  {
    id: "premium-14",
    name: "Fourteen-night premium demo",
    duration: "14 nights",
    makkahHotel: "Makkah Gate Sample",
    madinahHotel: "Rawdah View Sample",
    transport: "Private transfer",
    visa: "Visa guidance included",
    price: 560000,
    category: "Premium",
    tone: "tour",
  },
];

export const durations = ["Any duration", "7 nights", "10 nights", "14 nights"] as const;

export const hotelCategories = ["Any category", "Economy", "Standard", "Premium"] as const;

export const priceBands = [
  { label: "Any price", min: 0, max: 2_000_000 },
  { label: "Under PKR 250,000", min: 0, max: 249_999 },
  { label: "PKR 250,000 – 400,000", min: 250_000, max: 400_000 },
  { label: "Over PKR 400,000", min: 400_001, max: 2_000_000 },
] as const;

export const serviceNotes = {
  visa: [
    {
      title: "Document checklist",
      description: "A sample list of passport and photo items. This page does not file a visa.",
    },
    {
      title: "Sample timing",
      description: "Demo note that visa steps are planned before the departure date.",
    },
    {
      title: "Included on packages",
      description: "Each demo package card says visa guidance is included. It is not an approval.",
    },
  ],
  hotels: [
    {
      title: "Makkah stay",
      description: "The Makkah hotel name on each card is a sample property, not a live allotment.",
    },
    {
      title: "Madinah stay",
      description: "The Madinah hotel name on each card is a sample property, not a live allotment.",
    },
    {
      title: "Hotel category",
      description: "Filter packages by Economy, Standard, or Premium. These are demo labels.",
    },
  ],
  transport: [
    {
      title: "Shared coach",
      description: "Sample group transfer between Jeddah, Makkah, and Madinah.",
    },
    {
      title: "Private transfer",
      description: "Sample private vehicle for families who want their own timing.",
    },
    {
      title: "Airport arrival",
      description: "Demo note that arrival help can be added to a plan. Nothing is booked here.",
    },
  ],
  ziyarat: [
    {
      title: "Makkah area",
      description: "Sample visits around Makkah, listed as an outline only.",
    },
    {
      title: "Madinah area",
      description: "Sample visits around Madinah, listed as an outline only.",
    },
    {
      title: "Not a departure",
      description: "Ziyarat on this page is a description. It is not a confirmed tour.",
    },
  ],
} as const;

export function getDemoPackage(id: string) {
  return demoPackages.find((item) => item.id === id);
}

export function formatPackagePrice(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo`;
}
