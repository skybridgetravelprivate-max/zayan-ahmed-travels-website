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
  ...emptyWebsitePage("Flights, Visa & Umrah, planned around you"),
  eyebrow: "Your travel partner in Abbottabad",
  summary:
    "Plan flights, visas, Umrah and tours with your travel desk in Abbottabad. Share your dates and destination. We’ll help you compare the details.",
  actionLabel: "Get a free travel quote",
  actionHref: "/get-free-quote",
  sections: [
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
      id: "offers",
      title: "Travel options for your next journey",
      description:
        "Ask for flight options and an itemised quotation for your travel dates.",
      visible: true,
      layout: "cards",
      cards: [
        card(
          "Flight enquiries",
          "Find the right route for your dates.",
          "/flights",
          "Request options",
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
          "Umrah packages",
          "Plan your time in Makkah and Madinah.",
          "/umrah",
        ),
        card(
          "Visa assistance",
          "Understand the requirements for your destination.",
          "/visa",
        ),
        card("Tours", "Share your family or group travel plans.", "/tours"),
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
