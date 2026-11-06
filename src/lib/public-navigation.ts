type Link = { label: string; href: string };
export const primaryServices: Link[] = [
  { label: "Flights", href: "/flights" },
  { label: "Umrah Packages", href: "/umrah" },
  { label: "Visa", href: "/visa" },
  { label: "Tours", href: "/tours" },
];
/** Presentation scope only: legacy routes, records and internal services remain. */
export function focusedNavigation(items: Link[]) {
  const secondary = new Set(["/about", "/contact"]);
  return [
    ...primaryServices,
    ...items
      .filter((item) => secondary.has(item.href))
      .filter(
        (item, index, all) =>
          all.findIndex((other) => other.href === item.href) === index,
      ),
  ];
}
