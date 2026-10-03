export type BookingStatus = "Upcoming" | "Completed" | "Cancelled";

export type DemoBooking = {
  id: string;
  reference: string;
  service: string;
  destination: string;
  travelDate: string;
  status: BookingStatus;
};

export const demoBookings: readonly DemoBooking[] = [
  {
    id: "jeddah-flight",
    reference: "ZY-DEMO-10421",
    service: "Flight",
    destination: "Islamabad to Jeddah",
    travelDate: "12 Nov 2026",
    status: "Upcoming",
  },
  {
    id: "makkah-hotel",
    reference: "ZY-DEMO-10488",
    service: "Hotel",
    destination: "Makkah",
    travelDate: "18 Nov 2026",
    status: "Upcoming",
  },
  {
    id: "umrah-plan",
    reference: "ZY-DEMO-09812",
    service: "Umrah",
    destination: "Makkah and Madinah",
    travelDate: "2 Mar 2026",
    status: "Completed",
  },
  {
    id: "uae-visa",
    reference: "ZY-DEMO-09755",
    service: "Visa",
    destination: "UAE",
    travelDate: "15 Jan 2026",
    status: "Cancelled",
  },
];

export const bookingTabs = ["All", "Upcoming", "Completed", "Cancelled"] as const;

/** Sample profile only. A signed-in customer record is not stored here. */
export const demoProfile = {
  source: "demo" as const,
  displayName: "Demo Traveller",
  accountStatus: "Not signed in",
};

export type AccountPanel =
  | "bookings"
  | "documents"
  | "visas"
  | "support"
  | "settings";

export const accountPanels: readonly {
  id: AccountPanel;
  title: string;
  empty: string;
}[] = [
  {
    id: "documents",
    title: "Travel Documents",
    empty: "No demo documents are stored. This account is not connected to a record.",
  },
  {
    id: "visas",
    title: "Visa Applications",
    empty: "No demo visa applications are stored. Nothing is filed from this page.",
  },
  {
    id: "support",
    title: "Support",
    empty: "Support messages are not connected. This panel does not send a request.",
  },
  {
    id: "settings",
    title: "Account Settings",
    empty: "Settings are not available on this screen.",
  },
];
