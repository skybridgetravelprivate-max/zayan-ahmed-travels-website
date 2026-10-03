import type { ArtTone } from "@/components/home/PlaceholderArt";

export type VisaType = "Visit" | "Umrah" | "Business";

export type DemoVisa = {
  id: string;
  destination: string;
  type: VisaType;
  description: string;
  requirements: string;
  fee: number;
  tone: ArtTone;
};

export const demoVisas: readonly DemoVisa[] = [
  {
    id: "saudi",
    destination: "Saudi Arabia",
    type: "Umrah",
    description: "Demo card for a Saudi Umrah visa category. This is not an application.",
    requirements: "Sample summary only: passport and travel dates. Not an official list.",
    fee: 25000,
    tone: "makkah",
  },
  {
    id: "uae",
    destination: "UAE",
    type: "Visit",
    description: "Demo card for a UAE visit visa category. This is not an application.",
    requirements: "Sample summary only: passport and a travel plan. Not an official list.",
    fee: 18000,
    tone: "tour",
  },
  {
    id: "uk",
    destination: "UK",
    type: "Business",
    description: "Demo card for a UK business visa category. This is not an application.",
    requirements: "Sample summary only: passport and a trip purpose. Not an official list.",
    fee: 42000,
    tone: "hotel",
  },
  {
    id: "schengen",
    destination: "Schengen",
    type: "Visit",
    description: "Demo card for a Schengen visit visa category. This is not an application.",
    requirements: "Sample summary only: passport and travel dates. Not an official list.",
    fee: 35000,
    tone: "makkah",
  },
  {
    id: "turkey",
    destination: "Turkey",
    type: "Visit",
    description: "Demo card for a Turkey visit visa category. This is not an application.",
    requirements: "Sample summary only: passport and a travel plan. Not an official list.",
    fee: 12000,
    tone: "hotel",
  },
];

export const destinations = [
  "All destinations",
  "Saudi Arabia",
  "UAE",
  "UK",
  "Schengen",
  "Turkey",
] as const;

export const visaTypes = ["All types", "Visit", "Umrah", "Business"] as const;

export function getDemoVisa(id: string) {
  return demoVisas.find((item) => item.id === id);
}

export function formatDemoFee(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo fee`;
}
