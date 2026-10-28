import type { WebsiteContent, WebsiteSettings } from "@/lib/website-content";
import { companyContact, navItems, site } from "@/config/site";
export const defaultWebsiteSettings: WebsiteSettings = {
  companyName: site.legalName,
  tagline: site.tagline,
  email: companyContact.email,
  phones: ["03121558860", "03195500510"],
  address: companyContact.address,
  whatsapp: "923121558860",
  logo: "",
  logoAlt: "",
  nav: navItems.map((n) => ({ ...n })),
  social: [],
  announcement: "",
  seoTitle: site.legalName,
  seoDescription:
    "Flights, hotels, Umrah, visas, tours and transport. Plan your journey with Zayan Ahmed Travels in Abbottabad.",
};
export function emptyWebsitePage(title = "New page"): WebsiteContent {
  return {
    schemaVersion: 1,
    category: "page",
    title,
    summary: "",
    body: "",
    eyebrow: "Zayan Ahmed Travels",
    image: "",
    imageAlt: "",
    actionLabel: "",
    actionHref: "",
    sections: [],
  };
}
const card = (
  title: string,
  text: string,
  href: string,
  label = "Explore service",
) => ({ title, text, image: "", imageAlt: "", href, label });
export const defaultHomepage: WebsiteContent = {
  ...emptyWebsitePage("Umrah made easier with us"),
  eyebrow: "Your travel partner in Abbottabad",
  summary:
    "Flights, hotels, Umrah, visas, tours and complete travel planning. Tell us where you want to go. We’ll help you plan the details.",
  actionLabel: "Plan your Umrah",
  actionHref: "/umrah#plan",
  sections: [
    {
      id: "services",
      title: "Every journey, one travel desk",
      description:
        "Explore our services and send your requirements to the team.",
      visible: true,
      layout: "cards",
      cards: [
        card(
          "Air ticketing",
          "Routes, dates and fare-condition enquiries.",
          "/flights",
        ),
        card(
          "Hotel reservations",
          "Discuss your accommodation needs.",
          "/hotels",
        ),
        card(
          "Umrah packages",
          "Plan your time in Makkah and Madinah.",
          "/umrah",
        ),
        card(
          "Visa assistance",
          "Understand the requirements for your destination.",
          "/visa",
        ),
        card(
          "Transport services",
          "Airport transfers and group journeys.",
          "/transport",
        ),
        card(
          "Group tours",
          "Share your family or group travel plans.",
          "/tours",
        ),
      ],
    },
    {
      id: "packages",
      title: "Featured Umrah packages",
      description:
        "Published travel plans from our desk. Confirm dates, inclusions and availability in a written quotation.",
      visible: true,
      layout: "cards",
      cards: [],
    },
    {
      id: "destinations",
      title: "Where would you like to go?",
      description:
        "Start a conversation about your next destination. Trip ideas, not confirmed departures.",
      visible: true,
      layout: "cards",
      cards: [
        card(
          "Dubai",
          "Discuss a city break, flights and accommodation.",
          "/tours",
          "Plan a journey",
        ),
        card(
          "Istanbul",
          "Explore your preferences for a trip to Türkiye.",
          "/tours",
          "Plan a journey",
        ),
        card(
          "Kuala Lumpur",
          "Ask about flights and stays.",
          "/tours",
          "Plan a journey",
        ),
        card(
          "London",
          "Share your travel-document questions.",
          "/tours",
          "Plan a journey",
        ),
        card(
          "Baku",
          "Talk to the desk about your itinerary.",
          "/tours",
          "Plan a journey",
        ),
      ],
    },
    {
      id: "offers",
      title: "Travel options for your next journey",
      description:
        "Ask for a current quotation. No live fares or unverified discounts are advertised.",
      visible: true,
      layout: "cards",
      cards: [
        card(
          "Flight enquiries",
          "Find the right route for your dates.",
          "/flights",
          "Request options",
        ),
        card(
          "Hotel enquiries",
          "Discuss the details of your stay.",
          "/hotels",
          "Request options",
        ),
        card(
          "Group travel",
          "Plan a journey together.",
          "/group-booking",
          "Plan your group",
        ),
      ],
    },
    {
      id: "why",
      title: "Plan with clear information",
      description: "Your journey, our responsibility.",
      visible: true,
      layout: "cards",
      cards: [
        card(
          "One conversation",
          "Coordinate your requirements with our team.",
          "/contact",
          "Talk to the desk",
        ),
        card(
          "A written quotation",
          "Review inclusions, exclusions and conditions before deciding.",
          "/contact",
          "Request a quote",
        ),
        card(
          "Your travel documents",
          "Check the final itinerary and documents before departure.",
          "/travel-guide",
          "Read the guide",
        ),
      ],
    },
    {
      id: "stories",
      title: "What our travellers say",
      description: "Only reviewed, published customer feedback appears here.",
      visible: true,
      layout: "testimonials",
      cards: [],
    },
  ],
};
