import { getWebsitePage } from "@/server/website-content";
import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
const fallbackMetadata: Metadata = {
  title: servicePages.corporate.title,
  description: servicePages.corporate.intro,
};
export default function Page() {
  return <ServiceLanding service="corporate" />;
}

export async function generateMetadata() {
  const page = await getWebsitePage("corporate");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
