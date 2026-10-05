export const site = {
  legalName: "Zayan Ahmed Travels Private Limited",
  shortName: "Zayan Ahmed Travels",
  tagline: "Your Journey, Our Responsibility",
  /** Production public origin. Override at runtime with SITE_URL for staging. */
  url: "https://www.zayanahmedtravels.com",
} as const;

/** Shared description already used for the public site title and social tags. */
export const siteDescription = `${site.tagline}. ${site.legalName} online travel portal.`;

/** Public site URL: SITE_URL when set, otherwise production `site.url`. */
function publicSiteUrl() {
  const configured = process.env.SITE_URL?.trim() ?? "";
  return configured || site.url;
}

/** Origin used by metadata. Credentials and non-http schemes are rejected. */
export function siteOrigin() {
  const url = new URL(publicSiteUrl());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Site URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Site URL must not include credentials.");
  }
  return new URL(url.origin);
}

/** Indexing is allowed only when the public origin matches production. */
export function allowSearchIndexing() {
  return siteOrigin().origin === new URL(site.url).origin;
}

/** Public contact details shown on Contact and Footer. Leave blank if not approved. */
export const companyContact = {
  email: "zayanahmedtravels@gmail.com",
  address: "Pine View Road, Main Cantt Chowk, Abbottabad",
  website: "https://www.zayanahmedtravels.com",
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
