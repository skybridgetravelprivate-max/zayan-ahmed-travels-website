import type { MetadataRoute } from "next";
import { navItems, policyLinks, siteOrigin } from "@/config/site";
import { demoFlights } from "@/config/flights";
import { demoHotels } from "@/config/hotels";
import { demoOffers } from "@/config/offers";
import { demoTours } from "@/config/tours";
import { transportServices } from "@/config/transport";
import { guideCategories } from "@/config/travel-guide";
import { demoPackages } from "@/config/umrah";
import { demoVisas } from "@/config/visa";

const staticPaths = [
  ...navItems.map((item) => item.href),
  ...policyLinks.map((item) => item.href),
  "/my-bookings",
];

const detailPaths = [
  ...demoFlights.map((item) => `/flights/${item.id}`),
  ...demoHotels.map((item) => `/hotels/${item.id}`),
  ...demoOffers.map((item) => `/offers/${item.id}`),
  ...demoTours.map((item) => `/tours/${item.id}`),
  ...transportServices.map((item) => `/transport/${item.id}`),
  ...guideCategories.map((item) => `/travel-guide/${item.slug}`),
  ...demoPackages.map((item) => `/umrah/${item.id}`),
  ...demoVisas.map((item) => `/visa/${item.id}`),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const paths = [...new Set([...staticPaths, ...detailPaths])];

  return paths.map((path) => ({
    url: new URL(path, origin).href,
  }));
}
