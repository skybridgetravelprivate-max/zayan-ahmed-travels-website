import type { GuideArticle } from "@/config/travel-guide";

export function GuideArticles({
  articles,
}: {
  articles: readonly GuideArticle[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {articles.map((article) => {
        return (
          <article
            key={article.title}
            className="rounded-2xl border border-line bg-white p-6 sm:p-8"
          >
            <h2 className="text-xl font-bold text-zayan-blue">
              {article.title}
            </h2>
            <p className="mt-3 font-medium leading-7 text-zayan-blue">
              {article.excerpt}
            </p>
            {article.body.map((paragraph) => (
              <p key={paragraph} className="mt-4 leading-7 text-muted">
                {paragraph}
              </p>
            ))}
          </article>
        );
      })}
    </div>
  );
}
