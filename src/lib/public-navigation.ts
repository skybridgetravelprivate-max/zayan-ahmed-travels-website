type Link = { label: string; href: string };
export const primaryServices: Link[] = [
  { label: "Flights", href: "/flights" },
  { label: "Groups", href: "/group-booking" },
  { label: "Umrah", href: "/umrah" },
  { label: "Hotels", href: "/hotels" },
  { label: "Holidays", href: "/tours" },
  { label: "Visas", href: "/visa" },
];
/** Presentation scope only: legacy routes, records and internal services remain. */
export function focusedNavigation(items: Link[]) {
  const secondary = new Set(["/offers", "/travel-guide", "/about", "/contact", "/account"]);
  return [...primaryServices, ...items.filter(item => secondary.has(item.href)).filter((item, index, all) => all.findIndex(other => other.href === item.href) === index)];
}
