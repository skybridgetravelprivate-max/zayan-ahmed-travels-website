"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { GuideArticle } from "@/config/travel-guide";

export function GuideArticles({ articles }: { articles: readonly GuideArticle[] }) {
  const [openTitle, setOpenTitle] = useState<string | null>(null);

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {articles.map((article) => {
        const open = openTitle === article.title;

        return (
          <li key={article.title}>
            <Card
              title={article.title}
              description={article.excerpt}
              className={open ? "ring-2 ring-zayan-orange" : ""}
            >
              <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                Demo article
              </p>
              <Button
                className="mt-4"
                variant={open ? "secondary" : "primary"}
                aria-pressed={open}
                onClick={() => setOpenTitle(open ? null : article.title)}
              >
                Read More
              </Button>
              {open ? (
                <p role="status" className="mt-3 text-sm text-zayan-blue">
                  Demo only. The full article is not available yet.
                </p>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
