/** Planning categories adapted from the approved Trips.pk Umrah reference.
 * These are inquiry preferences, not a claim of available inventory. */
export const departureCities = ["Lahore", "Karachi", "Islamabad", "Quetta", "Peshawar", "Multan", "Faisalabad", "Sialkot"] as const;
export const tripDays = [7, 10, 14, 15, 21, 28] as const;
export const packagePreferences = ["Economy", "2–3 star", "4 star", "5 star", "Luxury / VIP", "Family", "Ramadan", "Rabi ul Awwal", "Umrah + combination"] as const;
export const internationalOrigins = ["UAE", "Canada", "Italy", "South Africa", "UK", "Australia", "Austria", "Norway", "USA", "Germany", "Greece", "Sweden", "Singapore", "France", "Hong Kong", "Russia", "Turkey"] as const;
export const combinationTrips = ["Saudi Arabia", "Qatar", "Dubai"] as const;
export const umrahQuestions = [
  ["What can an Umrah package include?", "Ask for an itemised quote covering flights, visa assistance, Makkah and Madinah hotels, transfers, meals and ziyarat. Inclusion depends on the agreed package; a planning selection does not confirm any service."],
  ["How long should I stay?", "Choose a duration that fits your travel dates, budget and pace. This page offers planning choices from 7 to 28 days. Confirm the number of hotel nights separately from total travel days."],
  ["How is the price calculated?", "Dates, flights, room occupancy, hotel category and distance, transport and group size affect the quote. A supplier's advertised rate is not our confirmed selling price. Request a written quotation."],
  ["Can I request hotels near the Haram?", "Yes. Tell the travel desk your preferred walking distance, accessibility needs and room type. Ask for the exact hotel, location and any shuttle timetable before confirming."],
  ["Can families or solo travellers enquire?", "Yes. Include adults, children and infants, room sharing preferences and assistance needs. The desk must verify eligibility and current travel requirements for each traveller."],
  ["Can I request private transport?", "Specify airport transfers, travel between Makkah and Madinah, vehicle size and ziyarat requirements. Private and shared transfers must be priced and confirmed separately."],
  ["What documents and visa rules apply?", "Requirements depend on nationality, residence, visa category and travel dates. Ask the desk to verify current official requirements before making non-refundable arrangements. This page does not issue visas or guarantee approval."],
  ["Can I travel from outside Pakistan?", "Select an international origin in the inquiry planner. Flights, entry eligibility and service availability require individual confirmation; the list is not a promise of a scheduled departure."],
  ["Can Umrah be combined with another destination?", "You can enquire about a Saudi extension, Qatar or Dubai. Each destination needs separate checks for transit, entry eligibility, flights, accommodation and cost."],
  ["Does submitting this form book or charge me?", "No. It sends an inquiry to our travel desk. Confirm the itinerary, price, availability and written terms before following the company's approved booking and payment process."],
] as const;

export function umrahPlanningContext(origin: string, days: string, preference: string, extension: string) {
  return `Umrah planning request: departure ${origin}; duration ${days} days (hotel nights to confirm); preference ${preference}; extension ${extension || "None"}. Availability and price require confirmation.`;
}
