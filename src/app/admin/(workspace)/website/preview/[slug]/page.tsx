import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { defaultHomepage } from "@/config/website";
import { notFound } from "next/navigation";
import { staffRequest } from "@/server/staff-api";
import { parseContent } from "@/lib/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
export const metadata = {
  title: "Private website preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(slug)) notFound();
  const r = await staffRequest(`/api/v1/website/pages/${slug}`);
  if (!r?.ok) notFound();
  const row = await r.json();
  const content = parseContent(row.draft);
  return (
    <>
      <p className="mb-5 rounded-xl border border-line bg-white p-4 text-sm font-bold">
        Private saved draft preview · {slug} · version {row.version} · not
        published
      </p>
      {content.settings ? (
        <>
          <Header settings={content.settings} />
          <WebsiteView content={defaultHomepage} home />
          <Footer settings={content.settings} />
        </>
      ) : (
        <WebsiteView content={content} home={slug === "home"} />
      )}
    </>
  );
}
