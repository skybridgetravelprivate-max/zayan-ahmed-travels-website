import { getWebsitePage } from "@/server/website-content";
import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
const fallbackMetadata: Metadata = {
  title: servicePages.tickets.title,
  description: servicePages.tickets.intro,
};
export default function Page() {
  return <ServiceLanding service="tickets" />;
}

export async function generateMetadata() {
  const page = await getWebsitePage("tickets");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
