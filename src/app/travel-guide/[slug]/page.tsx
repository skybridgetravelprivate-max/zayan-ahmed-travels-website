import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/travel-guide/Breadcrumbs";
import { GuideArticles } from "@/components/travel-guide/GuideArticles";
import { getGuideCategory, guideCategories } from "@/config/travel-guide";
import { site } from "@/config/site";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return guideCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getGuideCategory(slug);

  if (!category) {
    return { title: "Travel Guide" };
  }

  return {
    title: `${category.title} guide`,
    description: `${category.intro} ${site.shortName}.`,
  };
}

export default async function GuideCategoryPage({ params }: GuidePageProps) {
  const { slug } = await params;
  const category = getGuideCategory(slug);

  if (!category) {
    notFound();
  }

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Travel Guide", href: "/travel-guide" },
              { label: category.title, href: `/travel-guide/${category.slug}` },
            ]}
          />
        </div>
      </div>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Travel Guide
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {category.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">{category.intro}</p>
        </div>
      </section>
      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="sr-only">Articles</h2>
          <GuideArticles articles={category.articles} />
        </div>
      </div>
    </>
  );
}
