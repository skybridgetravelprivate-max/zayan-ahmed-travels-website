import assert from "node:assert/strict";
import { test } from "node:test";
import { getGuideCategory, guideCategories } from "./travel-guide";

test("original guides retain legacy categories and give each route substantive content", () => {
  const slugs = guideCategories.map((guide) => guide.slug);
  assert.equal(new Set(slugs).size, 8);
  for (const slug of [
    "umrah",
    "visa",
    "flights",
    "hotels",
    "airports",
    "currency",
    "travel-tips",
    "tours",
  ]) {
    const guide = getGuideCategory(slug);
    assert.ok(guide);
    assert.equal(guide.articles.length, 4);
    assert.match(
      guide.serviceHref,
      /^\/(?:umrah#plan|(?:flights|visa|hotels|tours)#inquiry|get-free-quote)$/,
    );
    for (const article of guide.articles) {
      assert.ok(article.excerpt.length > 30);
      assert.equal(article.body.length, 2);
      assert.ok(article.body.every((paragraph) => paragraph.length > 60));
    }
    assert.doesNotMatch(
      JSON.stringify(guide),
      /demo|placeholder|thetravel\.pk/i,
    );
  }
});

test("unknown and prototype-like guide slugs cannot resolve to public content", () => {
  for (const slug of [
    "not-a-guide",
    "__proto__",
    "constructor",
    "toString",
    "../visa",
    "Visa",
    "",
  ]) {
    assert.equal(getGuideCategory(slug), undefined);
  }
});
