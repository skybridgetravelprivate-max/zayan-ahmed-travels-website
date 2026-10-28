import { notFound } from "next/navigation";
import { WebsiteView } from "@/components/website/WebsiteView";
import { getWebsitePage } from "@/server/website-content";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = slug !== "site-settings" && (await getWebsitePage(slug));
  return p
    ? { title: p.content.title, description: p.content.summary }
    : { title: "Page unavailable", robots: { index: false, follow: false } };
}
export default async function PublishedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (["site-settings", "home"].includes(slug)) notFound();
  const page = await getWebsitePage(slug);
  if (!page) notFound();
  return <WebsiteView content={page.content} />;
}
