export const tripTypes = ["Round Trip", "One Way", "Multi City"] as const;

export type TripType = (typeof tripTypes)[number];

export const cabinClasses = [
  "Economy",
  "Premium Economy",
  "Business",
  "First",
] as const;

export type DemoFlight = {
  id: string;
  airline: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  duration: string;
  stops: "Non-stop" | "1 stop" | "2 stops";
  baggage: string;
  price: number;
};

export const demoFlights: readonly DemoFlight[] = [
  {
    id: "cedar-jed",
    airline: "Cedar Air",
    from: "Islamabad",
    to: "Jeddah",
    depart: "02:10",
    arrive: "06:40",
    duration: "6h 30m",
    stops: "Non-stop",
    baggage: "30 kg checked",
    price: 148500,
  },
  {
    id: "horizon-jed",
    airline: "Horizon Link",
    from: "Islamabad",
    to: "Jeddah",
    depart: "08:40",
    arrive: "16:05",
    duration: "9h 25m",
    stops: "1 stop",
    baggage: "2 × 23 kg checked",
    price: 121900,
  },
  {
    id: "amber-jed",
    airline: "Amber Wings",
    from: "Islamabad",
    to: "Jeddah",
    depart: "22:15",
    arrive: "13:50",
    duration: "17h 35m",
    stops: "2 stops",
    baggage: "20 kg checked",
    price: 98400,
  },
];

export const priceBands = [
  { label: "Any price", min: 0, max: 1_000_000 },
  { label: "Under PKR 110,000", min: 0, max: 109_999 },
  { label: "PKR 110,000 – 140,000", min: 110_000, max: 140_000 },
  { label: "Over PKR 140,000", min: 140_001, max: 1_000_000 },
] as const;

export function getDemoFlight(id: string) {
  return demoFlights.find((flight) => flight.id === id);
}

export function formatDemoPrice(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo`;
}
