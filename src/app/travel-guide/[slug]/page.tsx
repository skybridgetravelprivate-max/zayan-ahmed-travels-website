import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuideCategory } from "@/config/travel-guide";
import { GuideArticles } from "@/components/travel-guide/GuideArticles";

type PageProps = { params: Promise<{ slug: string }> };

export default async function GuidePage({ params }: PageProps) {
  const guide = getGuideCategory((await params).slug);
  if (!guide) notFound();

  return (
    <>
      <section className="travel-service-hero">
        <div className="travel-container">
          <nav aria-label="Breadcrumb" className="text-sm text-white/85">
            <Link href="/">Home</Link> /{" "}
            <Link href="/travel-guide">Travel guide</Link>
          </nav>
          <h1 className="mt-4 text-3xl font-bold sm:text-5xl">{guide.title}</h1>
          <p className="mt-5 max-w-3xl leading-8 text-white/85">
            {guide.intro}
          </p>
        </div>
      </section>
      <section
        className="travel-container py-12"
        aria-label="Travel planning guidance"
      >
        <GuideArticles articles={guide.articles} />
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Make the plan your own</h2>
          <p className="mt-3 max-w-3xl leading-7 text-muted">
            Tell our Abbottabad travel desk about your dates, group and
            preferences. We can discuss your questions and prepare a written
            quotation for the proposed arrangements.
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link className="website-cta" href={guide.serviceHref}>
              Discuss your travel plan
            </Link>
            <Link
              className="inline-flex min-h-11 items-center font-semibold underline"
              href="/travel-guide"
            >
              Explore all guides
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const guide = getGuideCategory((await params).slug);
  if (!guide) notFound();
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/travel-guide/${guide.slug}` },
  };
}
