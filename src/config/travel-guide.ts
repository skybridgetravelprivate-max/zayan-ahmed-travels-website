export type GuideArticle = {
  title: string;
  excerpt: string;
  body: readonly string[];
};

export type GuideCategory = {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  serviceHref: string;
  articles: readonly GuideArticle[];
};

/** Original planning guidance. Offers and destination-specific rules need their own review. */
export const guideCategories: readonly GuideCategory[] = [
  {
    slug: "umrah",
    title: "Plan your Umrah journey",
    summary:
      "Compare hotel nights, room sharing, transport and travel documents before choosing an Umrah arrangement.",
    intro:
      "Start with the people travelling and the pace that suits them. Use these questions when reviewing your plan with the Zayan travel desk.",
    serviceHref: "/umrah#plan",
    articles: [
      {
        title: "Separate travel days from hotel nights",
        excerpt:
          "A journey's duration and its accommodation nights can describe different parts of the trip.",
        body: [
          "Ask for arrival and departure dates, flight times and the number of nights in each city. Check when rooms become available after arrival and when checkout falls on departure day.",
          "Keep the complete schedule beside the quotation so changes to a flight can be checked against hotel and transfer arrangements.",
        ],
      },
      {
        title: "Choose accommodation around your group",
        excerpt:
          "Location, room occupancy and access matter alongside the hotel name or category.",
        body: [
          "Ask for the exact hotel, room-sharing arrangement, meal basis and location. Discuss lifts, walking routes and assistance needs for children or older travellers.",
          "Where a shuttle is proposed, ask about its pickup point, operating arrangements and any additional charge. Confirm these details in the quotation.",
        ],
      },
      {
        title: "Connect the transfers",
        excerpt:
          "Review each airport pickup, intercity journey and departure transfer as part of one itinerary.",
        body: [
          "Check whether each vehicle is private or shared, how luggage is accommodated and which journeys are included. Identify the contact and meeting arrangements for each pickup.",
          "Discuss ziyarat or additional stops separately, including their timing, transport and price before adding them to your plan.",
        ],
      },
      {
        title: "Check requirements for your circumstances",
        excerpt:
          "Entry, visa and travel requirements need to be reviewed for the actual traveller and dates.",
        body: [
          "Give the desk your nationality, country of residence and intended dates when asking about requirements. Verify current official guidance and the conditions of any proposed visa or permit.",
          "Keep passport scans, identity documents and payment information out of the public inquiry form. Ask the desk to explain the approved document-handling process.",
        ],
      },
    ],
  },
  {
    slug: "visa",
    title: "Prepare your visa questions",
    summary:
      "Organise the information needed to discuss visa categories, official requirements and application assistance.",
    intro:
      "Your destination is the starting point. Nationality, residence, travel purpose and the proposed journey help determine which official guidance applies.",
    serviceHref: "/visa#inquiry",
    articles: [
      {
        title: "Explain the purpose of your visit",
        excerpt:
          "Tourism, a family visit, business and transit can lead to different application questions.",
        body: [
          "Share the destination, intended dates, reason for travel and country where you normally live. Mention any connecting countries when discussing a flight route.",
          "Ask which visa category is being considered and confirm the current instructions on the relevant government or embassy's official website.",
        ],
      },
      {
        title: "Work from a current checklist",
        excerpt:
          "A checklist should match the applicant's circumstances and the proposed visa category.",
        body: [
          "Ask for the official source and the date its instructions were checked. Discuss which supporting documents apply to your situation before collecting or paying for them.",
          "Use accurate information throughout the application. Ask how originals, translations, appointments or attendance requirements will be handled where applicable.",
        ],
      },
      {
        title: "Understand each charge",
        excerpt:
          "Keep official application fees and agency assistance charges clearly identified.",
        body: [
          "Request an itemised quotation showing the currency, charge basis, included assistance and any additional appointment or document costs. Ask who receives each payment and when it is due.",
          "Review the written cancellation and refund conditions before paying. Ask the desk to explain the processing estimate and appointment arrangements separately.",
        ],
      },
      {
        title: "Plan around the application outcome",
        excerpt:
          "The relevant authority decides the application and the conditions of any permission granted.",
        body: [
          "Discuss timing before choosing commitments that depend on a visa. Ask the desk about the conditions attached to any proposed reservation or ticket.",
          "When a visa or decision arrives, check the traveller details, validity and stated conditions against the planned journey. Raise discrepancies before departure.",
        ],
      },
    ],
  },
  {
    slug: "flights",
    title: "Compare your flight options",
    summary:
      "Review routes, connections, baggage and fare conditions before accepting a flight quotation.",
    intro:
      "A useful comparison brings the whole journey together. Tell the Zayan desk which dates, airports and conditions matter to you.",
    serviceHref: "/flights#inquiry",
    articles: [
      {
        title: "Describe the complete route",
        excerpt:
          "Give each departure city, destination and travel date, including additional legs.",
        body: [
          "Explain whether you need a one-way, return or multi-city journey. Share date flexibility, preferred airports, cabin and the number of adults, children and infants.",
          "Check the airport names and dates on the proposed itinerary, including any overnight arrival or change of airport.",
        ],
      },
      {
        title: "Look beyond the headline fare",
        excerpt:
          "Baggage, seats, meals and ticket conditions affect what a quotation covers.",
        body: [
          "Ask for the applicable cabin and checked-baggage allowances for every flight. Review additional services you need and how their charges are shown.",
          "Confirm the selling currency, final quoted total, price validity and the next confirmation step.",
        ],
      },
      {
        title: "Review connections carefully",
        excerpt:
          "Connection time, transit requirements and baggage handling need to fit the proposed itinerary.",
        body: [
          "Ask whether connecting flights share a ticket and how a delay would affect the onward journey. Check whether you must collect baggage, change terminals or change airports.",
          "Verify transit and entry requirements for the countries on the route using current official guidance for your nationality and circumstances.",
        ],
      },
      {
        title: "Confirm the fare conditions",
        excerpt:
          "Understand changes, cancellation and passenger details before ticketing.",
        body: [
          "Ask for the conditions of the specific fare being offered, including applicable airline penalties and agency charges. Review the process for assistance if your plans change.",
          "Check passenger names against travel documents and review the flight schedule before approving issuance. Keep the issued itinerary and contact details available for travel.",
        ],
      },
    ],
  },
  {
    slug: "hotels",
    title: "Choose a stay that fits",
    summary:
      "Discuss room occupancy, location, meals, access and booking conditions before confirming accommodation.",
    intro:
      "A clear hotel request explains who is staying, the dates and the details that will make the visit practical.",
    serviceHref: "/hotels#inquiry",
    articles: [
      {
        title: "Match rooms to the guests",
        excerpt:
          "Confirm the exact room arrangement for adults, children and any assistance needs.",
        body: [
          "Share the guest count, room count and children's ages when requested by the desk. Ask about proposed bedding, occupancy limits and accessibility needs.",
          "Confirm the exact room category and any meal arrangement in writing before accepting the quotation.",
        ],
      },
      {
        title: "Check the location",
        excerpt:
          "Review how the property connects to the places you plan to visit.",
        body: [
          "Ask for the hotel's exact name and address. Discuss walking routes, transport and shuttle arrangements where these affect your plans.",
          "For pilgrimage travel, consider the practical route and group needs alongside any stated distance. Ask how that distance was described.",
        ],
      },
      {
        title: "Align arrival and departure",
        excerpt:
          "Flight times and hotel check-in or checkout times should be reviewed together.",
        body: [
          "Explain late arrivals, early arrivals or overnight travel before confirming the stay. Ask whether early access, late checkout or another night's accommodation is required and how it is priced.",
          "Keep transfer arrangements and hotel dates aligned if the travel schedule changes.",
        ],
      },
      {
        title: "Review the complete hotel quotation",
        excerpt:
          "Check the stay dates, selling currency, inclusions and cancellation terms.",
        body: [
          "Ask which meals, taxes or other charges are included and which are payable separately. Confirm any deposit, payment deadline and cancellation or change conditions.",
          "Review the hotel voucher and guest details before departure. Raise differences between the voucher and agreed quotation with the desk.",
        ],
      },
    ],
  },
  {
    slug: "tours",
    title: "Shape a trip around your group",
    summary:
      "Plan the pace, accommodation, transport and inclusions of a family, private or group itinerary.",
    intro:
      "Begin with your dates, interests and the people travelling. Turn those preferences into a day-by-day plan you can review.",
    serviceHref: "/tours#inquiry",
    articles: [
      {
        title: "Choose a realistic pace",
        excerpt:
          "Allow room for travel time, stops and the needs of the group.",
        body: [
          "Tell the desk which places or activities matter most and how much time you have. Discuss long driving days, rest time and assistance needs before settling the route.",
          "Ask which activities are included, optional or dependent on local conditions, and review alternatives for changes to the itinerary.",
        ],
      },
      {
        title: "Agree the accommodation basis",
        excerpt:
          "Room sharing, meal arrangements and hotel locations shape the travel experience.",
        body: [
          "Review the proposed properties or the agreed accommodation standard, room occupancy and meal basis. Ask how any substitutions would be communicated.",
          "Make children's arrangements, room preferences and access needs part of the written discussion.",
        ],
      },
      {
        title: "Connect the ground arrangements",
        excerpt:
          "Review pickups, vehicles and journey timings as part of the daily itinerary.",
        body: [
          "Discuss the vehicle arrangement, passenger and luggage capacity, pickup points and included driver or guide services.",
          "Ask how changes to flights, weather or local access would be handled and which additional costs could require a revised quotation.",
        ],
      },
      {
        title: "Compare an itemised itinerary",
        excerpt:
          "The written plan should explain what is included and what remains to be arranged.",
        body: [
          "Check dates, accommodation nights, transport, meals, activities and applicable charges. Confirm currency, quotation validity and payment and cancellation conditions.",
          "Review the final itinerary and service documents before travel and keep the agreed contact arrangements available.",
        ],
      },
    ],
  },
  {
    slug: "airports",
    title: "Prepare for airport day",
    summary:
      "Check airport details, transfers, connections and airline instructions before travelling.",
    intro:
      "Use the final itinerary and the airline's current instructions to plan the practical steps around your flights.",
    serviceHref: "/flights#inquiry",
    articles: [
      {
        title: "Check the exact airport and terminal",
        excerpt:
          "Cities can have more than one airport and a journey can involve different terminals.",
        body: [
          "Review each airport name and the local departure and arrival dates on the itinerary. Recheck terminal and flight information with the airline or airport before leaving.",
          "Use the airline's current check-in and boarding instructions to plan arrival at the airport.",
        ],
      },
      {
        title: "Keep travel documents accessible",
        excerpt:
          "Prepare the documents needed for the journey and retain access to your itinerary.",
        body: [
          "Check current entry and transit requirements against your circumstances. Keep required originals and a usable copy of the itinerary accessible during travel.",
          "Share sensitive documents only through the desk's approved process and keep them out of public inquiry messages.",
        ],
      },
      {
        title: "Plan connections and assistance",
        excerpt:
          "Discuss luggage handling, airport changes and assistance requirements in advance.",
        body: [
          "Ask how baggage and check-in work for each flight and whether the connection involves entering another country. Check those requirements before accepting the route.",
          "Contact the desk about assistance needs early enough for the relevant airline's process to be checked.",
        ],
      },
      {
        title: "Confirm the arrival pickup",
        excerpt:
          "Agree how you will locate a confirmed transfer after landing.",
        body: [
          "Keep the pickup point, contact and vehicle arrangement with your travel documents. Check how the pickup is handled if the flight arrives late.",
          "Review the onward destination and luggage needs before travel so the transfer can be checked against the itinerary.",
        ],
      },
    ],
  },
  {
    slug: "currency",
    title: "Understand your travel quotation",
    summary:
      "Check the currency, price basis, validity and included charges in a written travel quotation.",
    intro:
      "Compare the same services on the same basis. A clear quotation helps you see what has been priced and what needs confirmation.",
    serviceHref: "/get-free-quote",
    articles: [
      {
        title: "Identify the currency and price basis",
        excerpt: "A figure needs a currency and a clear unit to be meaningful.",
        body: [
          "Ask whether each amount is per traveller, per room, per night or for the whole group. Check the occupancy, dates and services used to calculate it.",
          "If amounts involve different currencies, ask how the payable amount will be established and when it will be confirmed.",
        ],
      },
      {
        title: "Check inclusions and additional charges",
        excerpt:
          "Review the total alongside the individual services being offered.",
        body: [
          "Ask which travel services, taxes and agency charges are included. Identify optional items and charges that may be paid separately.",
          "Compare quotations against the full itinerary, room arrangement, baggage and service conditions.",
        ],
      },
      {
        title: "Ask when the quotation expires",
        excerpt:
          "The price review and booking confirmation are separate steps in planning.",
        body: [
          "Request the quotation's validity and the confirmation process for each service. Recheck the amount and availability if your dates, group or itinerary change.",
          "Ask for a revised written quotation where the proposed arrangements differ from the earlier version.",
        ],
      },
      {
        title: "Keep payment records together",
        excerpt:
          "Review the company's approved payment instructions and keep the resulting records.",
        body: [
          "Ask the desk to identify the booking reference, agreed amount and applicable written terms before following payment instructions.",
          "Keep the receipt with the quotation and booking documents. Contact the desk to reconcile a payment question against those records.",
        ],
      },
    ],
  },
  {
    slug: "travel-tips",
    title: "Your pre-departure checklist",
    summary:
      "Bring the itinerary, documents, accommodation, transport and contact arrangements together before departure.",
    intro:
      "A final review is a chance to resolve differences while the complete plan is in front of you.",
    serviceHref: "/get-free-quote",
    articles: [
      {
        title: "Read the journey from start to finish",
        excerpt:
          "Compare traveller details, dates and locations across the final documents.",
        body: [
          "Check passenger names, travel dates, airport names, hotel nights and transfer times against the agreed plan. Ask the desk to review discrepancies before departure.",
          "Keep a usable copy of the itinerary and the relevant travel documents accessible throughout the trip.",
        ],
      },
      {
        title: "Recheck current requirements",
        excerpt:
          "Travel-document and entry guidance should match the journey you will actually take.",
        body: [
          "Review official entry and transit guidance for your nationality, residence and route. Discuss changes to your circumstances or itinerary with the desk.",
          "Check relevant airline and accommodation instructions, including baggage and arrival arrangements.",
        ],
      },
      {
        title: "Discuss practical needs early",
        excerpt:
          "The desk can review your request more clearly when your preferences are specific.",
        body: [
          "Raise mobility, room, meal, luggage or other assistance needs before accepting the plan. Ask which requests have been confirmed by the relevant service provider.",
          "Recheck those arrangements when reviewing the final itinerary and vouchers.",
        ],
      },
      {
        title: "Keep contacts and records available",
        excerpt:
          "Organise the information you may need if something changes during travel.",
        body: [
          "Save the desk's approved contact details and any contacts shown on confirmed travel documents. Discuss how to request help or report a schedule change.",
          "Keep the written quotation, confirmations, receipts and agreed changes together so questions can be reviewed against the same records.",
        ],
      },
    ],
  },
];

export function getGuideCategory(slug: string) {
  return guideCategories.find((category) => category.slug === slug);
}
