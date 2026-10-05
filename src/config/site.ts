export const site = {
  legalName: "Zayan Ahmed Travels Private Limited",
  shortName: "Zayan Ahmed Travels",
  tagline: "Your Journey, Our Responsibility",
  /** Public origin for canonical URLs, robots.txt, and the sitemap. */
  url: "https://www.zayanahmedtravels.com",
} as const;

/** Shared description already used for the public site title and social tags. */
export const siteDescription = `${site.tagline}. ${site.legalName} online travel portal.`;

/** Origin used by metadata. Credentials and non-http schemes are rejected. */
export function siteOrigin() {
  const url = new URL(site.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Site URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Site URL must not include credentials.");
  }
  return new URL(url.origin);
}

/** Public contact details. Leave blank until an approved address or email is added. */
export const companyContact = {
  address: "",
  email: "",
} as const;

export const navItems = [
  { label: "Home", href: "/" },
  { label: "Flights", href: "/flights" },
  { label: "Hotels", href: "/hotels" },
  { label: "Tours", href: "/tours" },
  { label: "Umrah", href: "/umrah" },
  { label: "Visas", href: "/visa" },
  { label: "Transport", href: "/transport" },
  { label: "Insurance", href: "/insurance" },
  { label: "Offers", href: "/offers" },
  { label: "Guide", href: "/travel-guide" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Corporate", href: "/corporate" },
  { label: "Groups", href: "/group-booking" },
  { label: "Account", href: "/account" },
] as const;

export const policyLinks = [
  { label: "Support", href: "/support" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refunds", href: "/refund-policy" },
  { label: "Cancellations", href: "/cancellation-policy" },
  { label: "Payments", href: "/payment-methods" },
] as const;
