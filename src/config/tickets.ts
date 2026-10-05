export const ticketTripTypes = ["Round Trip", "One Way"] as const;

export type TicketTripType = (typeof ticketTripTypes)[number];

export const ticketCabinClasses = [
  "Economy",
  "Premium Economy",
  "Business",
  "First",
] as const;

export type DemoTicket = {
  id: string;
  carrier: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  duration: string;
  cabin: (typeof ticketCabinClasses)[number];
  price: number;
};

/** Sample ticket cards only. Not live inventory. */
export const demoTickets: readonly DemoTicket[] = [
  {
    id: "demo-isb-jed-1",
    carrier: "Sample Carrier A",
    from: "Islamabad",
    to: "Jeddah",
    depart: "02:10",
    arrive: "06:40",
    duration: "6h 30m",
    cabin: "Economy",
    price: 148500,
  },
  {
    id: "demo-isb-jed-2",
    carrier: "Sample Carrier B",
    from: "Islamabad",
    to: "Jeddah",
    depart: "08:40",
    arrive: "16:05",
    duration: "9h 25m",
    cabin: "Economy",
    price: 121900,
  },
  {
    id: "demo-isb-jed-3",
    carrier: "Sample Carrier C",
    from: "Islamabad",
    to: "Jeddah",
    depart: "22:15",
    arrive: "13:50",
    duration: "17h 35m",
    cabin: "Business",
    price: 198400,
  },
];

export function formatDemoTicketPrice(amount: number) {
  const grouped = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `PKR ${grouped} demo`;
}
