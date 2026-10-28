import { getWebsitePage } from "@/server/website-content";
import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
const fallbackMetadata: Metadata = {
  title: servicePages.visa.title,
  description: servicePages.visa.intro,
};
export default function Page() {
  return <ServiceLanding service="visa" />;
}

export async function generateMetadata() {
  const page = await getWebsitePage("visa");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
