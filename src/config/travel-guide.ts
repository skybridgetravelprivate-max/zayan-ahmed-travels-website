import { site } from "@/config/site";

export type GuideArticle = {
  title: string;
  excerpt: string;
};

export type GuideCategory = {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  articles: readonly GuideArticle[];
};

export const guideCategories: readonly GuideCategory[] = [
  {
    slug: "umrah",
    title: "Umrah",
    summary: `Sample notes on how an Umrah outline from ${site.shortName} is described.`,
    intro:
      "Demo reading notes for Umrah plans. These articles do not reserve hotels, visas, or seats.",
    articles: [
      {
        title: "What a sample Umrah outline includes",
        excerpt:
          "A demo plan names the nights, the two cities, and the transfer style. It is not a confirmed package.",
      },
      {
        title: "Makkah and Madinah in one sample plan",
        excerpt:
          "Sample text on why both cities appear on the same card. Dates and hotels stay as labels.",
      },
      {
        title: "Packing notes for a demo itinerary",
        excerpt:
          "A short sample list of documents and comfortable clothing. It is not a packing rule.",
      },
      {
        title: "Questions to ask before you choose dates",
        excerpt:
          "Demo prompts about length of stay and who is travelling. Nothing here books a departure.",
      },
    ],
  },
  {
    slug: "visa",
    title: "Visa",
    summary: "Sample notes on how visa categories are labelled on this site.",
    intro:
      "Demo reading notes for visa categories. These articles do not file an application or list official rules.",
    articles: [
      {
        title: "How to read a demo visa category",
        excerpt:
          "Each category card is a label for a destination and a visa type. It is not an approval.",
      },
      {
        title: "Passport timing as a sample topic",
        excerpt:
          "A demo note that passport dates matter before travel. This page does not check a passport.",
      },
      {
        title: "Why fees on this site are labels",
        excerpt:
          "Fees on these cards are marked as demo figures. They are not a quote from an embassy.",
      },
      {
        title: "Family travel as a sample topic",
        excerpt:
          "A short note that families may be discussed together. No form is submitted from this guide.",
      },
    ],
  },
  {
    slug: "flights",
    title: "Flights",
    summary: "Sample notes on how demo flight cards are written.",
    intro:
      "Demo reading notes for flight cards. These articles do not search seats or show live fares.",
    articles: [
      {
        title: "Reading a demo fare card",
        excerpt:
          "A sample card shows airline, times, stops, baggage, and a demo price. None of those fields are live.",
      },
      {
        title: "Islamabad on sample routes",
        excerpt:
          "Demo routes often start in Islamabad. The city name is a label, not a timetable.",
      },
      {
        title: "Stops and duration on a sample ticket",
        excerpt:
          "Non-stop and one-stop labels help you compare demo cards. They do not confirm a seat.",
      },
      {
        title: "Baggage labels are not live rules",
        excerpt:
          "Checked-bag text on a demo card is a sample. The airline’s own rule is not shown here.",
      },
    ],
  },
  {
    slug: "hotels",
    title: "Hotels",
    summary: "Sample notes on how demo stay cards are written.",
    intro:
      "Demo reading notes for hotel cards. These articles do not hold rooms or publish live rates.",
    articles: [
      {
        title: "What a demo stay card shows",
        excerpt:
          "Name, city, stars, amenities, and a nightly demo price. The property is a sample.",
      },
      {
        title: "Makkah area sample notes",
        excerpt:
          "A demo card may say central Makkah. That phrase is not a measured walking distance.",
      },
      {
        title: "Madinah area sample notes",
        excerpt:
          "A demo card may mention the central area. No room is allocated from this guide.",
      },
      {
        title: "Star labels are not inspections",
        excerpt:
          "Star counts on this site sort sample cards. They are not an official hotel grade.",
      },
    ],
  },
  {
    slug: "airports",
    title: "Airports",
    summary: "Sample notes about airports that appear in demo plans.",
    intro:
      "Demo reading notes for airports named in sample journeys. These articles are not airport instructions.",
    articles: [
      {
        title: "Arrival as a sample topic",
        excerpt:
          "A demo plan may mention meeting a driver after you land. No pickup is arranged here.",
      },
      {
        title: "Jeddah in a sample Umrah plan",
        excerpt:
          "Jeddah often appears as the arrival city on a demo Umrah card. It is not a terminal map.",
      },
      {
        title: "Islamabad departures as a sample topic",
        excerpt:
          "Sample flight cards leave from Islamabad. This note does not list gates or counters.",
      },
      {
        title: "Leaving time between flights",
        excerpt:
          "A demo tip to keep a gap when two flights are on one plan. It is not a connection rule.",
      },
    ],
  },
  {
    slug: "currency",
    title: "Currency",
    summary: "Sample notes on how prices are labelled in PKR.",
    intro:
      "Demo reading notes for prices on this site. These articles are not exchange rates or payment advice.",
    articles: [
      {
        title: "Demo prices are not exchange rates",
        excerpt:
          "PKR figures on cards are sample labels. They do not convert currency and they are not quotes.",
      },
      {
        title: "Reading a demo fee",
        excerpt:
          "A fee marked “demo” is there so the layout can show a number. It is not payable from this page.",
      },
      {
        title: "Nightly stay labels",
        excerpt:
          "Hotel cards say “demo / night” so the figure is not mistaken for a live rate.",
      },
      {
        title: "Asking before you rely on a figure",
        excerpt:
          "A sample reminder that a printed demo price can change. This guide does not take payment.",
      },
    ],
  },
  {
    slug: "travel-tips",
    title: "Travel tips",
    summary: `Short sample reminders before a trip planned with ${site.shortName}.`,
    intro:
      "Demo reminders for travellers. These articles are sample text, not a live briefing.",
    articles: [
      {
        title: "Keep a copy of the plan",
        excerpt:
          "A demo reminder to save the outline you discussed. This page does not store a booking.",
      },
      {
        title: "Share the dates with family",
        excerpt:
          "A short sample note about telling someone your travel dates. No message is sent from here.",
      },
      {
        title: "Match the card to the trip",
        excerpt:
          "Demo advice to read the duration and city on a card before you compare it with another.",
      },
      {
        title: "This guide is not a departure",
        excerpt:
          "Every article in this section is sample copy. It does not confirm a flight, stay, or visa.",
      },
    ],
  },
];

export function getGuideCategory(slug: string) {
  return guideCategories.find((category) => category.slug === slug);
}
