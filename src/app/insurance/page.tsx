import { getWebsitePage } from "@/server/website-content";
import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
const fallbackMetadata: Metadata = {
  title: servicePages.insurance.title,
  description: servicePages.insurance.intro,
};
export default function Page() {
  return <ServiceLanding service="insurance" />;
}

export async function generateMetadata() {
  const page = await getWebsitePage("insurance");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
