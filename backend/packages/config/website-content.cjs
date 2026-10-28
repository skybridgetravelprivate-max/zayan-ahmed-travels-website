"use strict";

const categories = [
  "page",
  "umrah",
  "flight",
  "hotel",
  "visa",
  "tour",
  "transport",
  "destination",
  "offer",
  "guide",
  "testimonial",
];
function object(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Unexpected content field");
  return value;
}
function text(value, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ||
    (required && !value.trim())
  )
    throw new Error("Invalid content text");
  return value.trim();
}
function list(value, max) {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Too many content items");
  return value;
}
function href(value) {
  const s = text(value, 240);
  if (
    s &&
    (!/^\/(?!\/)[A-Za-z0-9/?&=#._~%+-]*$/.test(s) ||
      /%(?:2f|5c|2e)|\\/i.test(s) ||
      /^\/(?:api|admin)(?:\/|$|[?#])/i.test(s) ||
      s.split(/[/?#]/).includes(".."))
  )
    throw new Error("Use a public website link");
  return s;
}
function image(value) {
  const s = text(value, 240);
  if (
    s &&
    !/^\/(?:website-assets\/[a-z0-9-]+\.(?:jpg|png|webp|svg)|api\/public\/website\/media\/[A-Za-z0-9_-]{1,80})$/.test(
      s,
    )
  )
    throw new Error("Choose an image from the website media library");
  return s;
}
function parseContent(value) {
  const c = object(value, [
    "schemaVersion",
    "category",
    "title",
    "summary",
    "body",
    "eyebrow",
    "image",
    "imageAlt",
    "actionLabel",
    "actionHref",
    "sections",
    "settings",
    "searchEnabled",
    "searchTitle",
  ]);
  if (c.schemaVersion !== 1 || !categories.includes(c.category))
    throw new Error("Invalid content version or category");
  const content = {
    schemaVersion: 1,
    category: c.category,
    title: text(c.title, 180, true),
    summary: text(c.summary, 600),
    body: text(c.body, 20000),
    eyebrow: text(c.eyebrow, 100),
    image: image(c.image),
    imageAlt: text(c.imageAlt, 200),
    actionLabel: text(c.actionLabel, 60),
    actionHref: href(c.actionHref),
    sections: list(c.sections, 16).map((s) => {
      object(s, ["id", "title", "description", "visible", "layout", "cards"]);
      if (
        !/^[a-z][a-z0-9-]{0,45}$/.test(s.id) ||
        typeof s.visible !== "boolean" ||
        !["cards", "banner", "testimonials"].includes(s.layout)
      )
        throw new Error("Invalid section");
      return {
        id: s.id,
        title: text(s.title, 120, true),
        description: text(s.description, 600),
        visible: s.visible,
        layout: s.layout,
        cards: list(s.cards, 12).map((card) => {
          object(card, ["title", "text", "image", "imageAlt", "href", "label"]);
          const item = {
            title: text(card.title, 140, true),
            text: text(card.text, 1500),
            image: image(card.image),
            imageAlt: text(card.imageAlt, 200),
            href: href(card.href),
            label: text(card.label, 60),
          };
          if (item.image && !item.imageAlt)
            throw new Error("Image alternative text is required");
          if (!!item.href !== !!item.label)
            throw new Error("Link text and destination are both required");
          return item;
        }),
      };
    }),
  };
  if (
    new Set(content.sections.map((s) => s.id)).size !== content.sections.length
  )
    throw new Error("Section identifiers must be unique");
  if (content.image && !content.imageAlt)
    throw new Error("Image alternative text is required");
  if (!!content.actionHref !== !!content.actionLabel)
    throw new Error("Button text and destination are both required");
  if (c.searchEnabled !== undefined) {
    if (typeof c.searchEnabled !== "boolean")
      throw new Error("Invalid search-panel setting");
    content.searchEnabled = c.searchEnabled;
  }
  if (c.searchTitle !== undefined)
    content.searchTitle = text(c.searchTitle, 100);
  if (c.settings !== undefined) {
    const s = object(c.settings, [
      "companyName",
      "tagline",
      "email",
      "phones",
      "address",
      "whatsapp",
      "logo",
      "logoAlt",
      "nav",
      "social",
      "announcement",
      "seoTitle",
      "seoDescription",
    ]);
    const settings = {
      companyName: text(s.companyName, 180, true),
      tagline: text(s.tagline, 180),
      email: text(s.email, 180),
      phones: list(s.phones, 3).map((p) => text(p, 30, true)),
      address: text(s.address, 400),
      whatsapp: text(s.whatsapp, 18),
      logo: image(s.logo),
      logoAlt: text(s.logoAlt, 200),
      nav: list(s.nav, 20).map((n) => {
        object(n, ["label", "href"]);
        return { label: text(n.label, 40, true), href: href(n.href) };
      }),
      social: list(s.social, 8).map((n) => {
        object(n, ["label", "href"]);
        const value = text(n.href, 300, true);
        const u = new URL(value);
        if (u.protocol !== "https:" || u.username || u.password)
          throw new Error("Invalid social URL");
        return { label: text(n.label, 40, true), href: u.href };
      }),
      announcement: text(s.announcement, 300),
      seoTitle: text(s.seoTitle, 180),
      seoDescription: text(s.seoDescription, 600),
    };
    if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email))
      throw new Error("Invalid email");
    if (
      settings.phones.some((p) => !/^\+?[0-9 ()-]{7,30}$/.test(p)) ||
      (settings.whatsapp && !/^\d{8,15}$/.test(settings.whatsapp))
    )
      throw new Error("Invalid contact number");
    if (settings.logo && !settings.logoAlt)
      throw new Error("Logo alternative text required");
    if (settings.nav.some((n) => !n.href))
      throw new Error("Navigation destination required");
    content.settings = settings;
  }
  return content;
}
function mediaIds(content) {
  const images = [
    content.image,
    content.settings?.logo,
    ...content.sections.flatMap((s) => s.cards.map((c) => c.image)),
  ];
  return [
    ...new Set(
      images
        .filter(Boolean)
        .filter((s) => s.startsWith("/api/public/website/media/"))
        .map((s) => s.split("/").pop()),
    ),
  ];
}
module.exports = { parseContent, mediaIds, categories };
