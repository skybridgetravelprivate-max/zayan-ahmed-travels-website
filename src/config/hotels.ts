import type { ArtTone } from "@/components/home/PlaceholderArt";

export type HotelType = "City hotel" | "Resort" | "Apartment";

export type DemoRoom = {
  name: string;
  detail: string;
};

export type DemoPolicy = {
  title: string;
  text: string;
};

export type DemoHotel = {
  id: string;
  name: string;
  city: string;
  location: string;
  stars: 3 | 4 | 5;
  description: string;
  amenities: string;
  rooms: readonly DemoRoom[];
  policies: readonly DemoPolicy[];
  price: number;
  type: HotelType;
  tone: ArtTone;
};

export const demoHotels: readonly DemoHotel[] = [
  {
    id: "noor-court",
    name: "Noor Court",
    city: "Makkah",
    location: "Sample area in central Makkah",
    stars: 5,
    description: "Demo stay near central Makkah. No room is held.",
    amenities: "Wi-Fi, breakfast, shuttle",
    rooms: [
      { name: "Sample double room", detail: "Two sample beds for a short stay. No allotment is held." },
      { name: "Sample family room", detail: "Extra space on this demo card only. It is not a reserved room." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 45000,
    type: "City hotel",
    tone: "makkah",
  },
  {
    id: "quba-house",
    name: "Quba House",
    city: "Madinah",
    location: "Sample area in central Madinah",
    stars: 5,
    description: "Demo stay in central Madinah. No room is held.",
    amenities: "Wi-Fi, breakfast, prayer area",
    rooms: [
      { name: "Sample twin room", detail: "Two sample beds. Nothing is held for a guest." },
      { name: "Sample single room", detail: "A demo room for one traveller. It is not bookable here." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 36000,
    type: "City hotel",
    tone: "hotel",
  },
  {
    id: "marina-palm",
    name: "Marina Palm",
    city: "Dubai",
    location: "Sample waterfront area in Dubai",
    stars: 4,
    description: "Demo waterfront stay for a short city break.",
    amenities: "Wi-Fi, pool, breakfast",
    rooms: [
      { name: "Sample resort room", detail: "A demo room with a sample water view. No stay is confirmed." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 27000,
    type: "Resort",
    tone: "tour",
  },
  {
    id: "bosphorus-stay",
    name: "Bosphorus Stay",
    city: "Istanbul",
    location: "Sample city area in Istanbul",
    stars: 4,
    description: "Demo city hotel with a sample breakfast included.",
    amenities: "Wi-Fi, breakfast, city view",
    rooms: [
      { name: "Sample city room", detail: "A demo room for two travellers. Breakfast on this card is a sample label." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 19000,
    type: "City hotel",
    tone: "hotel",
  },
  {
    id: "corniche-suites",
    name: "Corniche Suites",
    city: "Abu Dhabi",
    location: "Sample corniche area in Abu Dhabi",
    stars: 3,
    description: "Demo resort-style stay along a sample corniche.",
    amenities: "Wi-Fi, pool, parking",
    rooms: [
      { name: "Sample suite", detail: "A larger demo room. The suite label is not a confirmed category." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 16000,
    type: "Resort",
    tone: "makkah",
  },
  {
    id: "margalla-rooms",
    name: "Margalla Rooms",
    city: "Islamabad",
    location: "Sample apartment area in Islamabad",
    stars: 3,
    description: "Demo apartment stay for a short Islamabad visit.",
    amenities: "Wi-Fi, kitchenette, parking",
    rooms: [
      { name: "Sample apartment", detail: "A demo apartment with a sample kitchenette. It is not a lease or a booking." },
    ],
    policies: [
      { title: "Check-in", text: "A finished note would give a check-in time. None is set on this demo page." },
      { title: "Cancellation", text: "This demo page does not set a cancellation deadline or fee." },
      { title: "Payment", text: "This page does not take payment and does not publish an account." },
    ],
    price: 11000,
    type: "Apartment",
    tone: "tour",
  },
];

export const priceBands = [
  { label: "Any price", min: 0, max: 1_000_000 },
  { label: "Under PKR 15,000", min: 0, max: 14_999 },
  { label: "PKR 15,000 – 30,000", min: 15_000, max: 30_000 },
  { label: "Over PKR 30,000", min: 30_001, max: 1_000_000 },
] as const;

export const starOptions = ["Any rating", "5 stars", "4 stars", "3 stars"] as const;

export const hotelTypes = ["All types", "City hotel", "Resort", "Apartment"] as const;

export function getDemoHotel(id: string) {
  return demoHotels.find((hotel) => hotel.id === id);
}

export function formatNightlyPrice(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo / night`;
}
