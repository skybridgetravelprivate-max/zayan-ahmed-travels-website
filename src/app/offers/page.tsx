import { getWebsitePage } from "@/server/website-content";
import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
const fallbackMetadata: Metadata = {
  title: servicePages.offers.title,
  description: servicePages.offers.intro,
};
export default function Page() {
  return <ServiceLanding service="offers" />;
}

export async function generateMetadata() {
  const page = await getWebsitePage("offers");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
