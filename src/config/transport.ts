import type { ArtTone } from "@/components/home/PlaceholderArt";

export type TransportService = {
  id: string;
  title: string;
  description: string;
  detail: string;
  tone: ArtTone;
};

export const transportServices: readonly TransportService[] = [
  {
    id: "airport-transfer",
    title: "Airport Transfer",
    description: "Demo pickup between the airport and your hotel. No vehicle is reserved.",
    detail: "Sample: Islamabad or Jeddah arrival",
    tone: "hotel",
  },
  {
    id: "private-car",
    title: "Private Car",
    description: "Demo private car for a family or small group. No driver is assigned.",
    detail: "Sample: city and intercity rides",
    tone: "tour",
  },
  {
    id: "coaster-bus",
    title: "Coaster/Bus",
    description: "Demo coaster or bus for a larger party. No seat plan is held.",
    detail: "Sample: group movement",
    tone: "makkah",
  },
  {
    id: "umrah-transport",
    title: "Umrah Transport",
    description: "Demo transfers for Makkah, Madinah, and the airport. Nothing is booked.",
    detail: "Sample: Jeddah, Makkah, and Madinah",
    tone: "makkah",
  },
];

export function getTransportService(id: string) {
  return transportServices.find((service) => service.id === id);
}
