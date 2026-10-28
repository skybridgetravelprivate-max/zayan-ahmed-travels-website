"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  categories,
  parseContent,
  type WebsiteContent,
  type WebsiteSection,
} from "@/lib/website-content";
import {
  defaultHomepage,
  defaultWebsiteSettings,
  emptyWebsitePage,
} from "@/config/website";
type PageRow = {
  id: string;
  slug: string;
  title: string;
  version: number;
  publishedVersion: number | null;
  reviewState: string;
  status: string;
  draft: WebsiteContent;
  revisions?: { version: number; action: string; createdAt: string }[];
};
type Media = { id: string; alt: string; documentId: string };
const control =
  "mt-1 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
const button =
  "min-h-11 rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-zayan-blue disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zayan-blue";
const api = "/api/v1/website";
async function request(url: string, method = "GET", data?: unknown) {
  const r = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 409)
    throw new Error(
      "A newer version exists. Your edits are preserved here. Reload the saved page before continuing.",
    );
  if (r.status === 401) throw new Error("Sign in again to continue.");
  if (r.status === 403)
    throw new Error("Your account cannot perform this action.");
  if (!r.ok)
    throw new Error(
      method === "GET"
        ? "Content could not be loaded."
        : "Save was not confirmed. Reload the saved page before retrying; check required fields and image/link values.",
    );
  return r.json();
}
function Text({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      {label}
      {multiline ? (
        <textarea
          className={control}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={control}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function WebsiteWorkspace({
  canEdit,
  canPublish,
}: {
  canEdit: boolean;
  canPublish: boolean;
}) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [selected, setSelected] = useState<PageRow | null>(null);
  const [content, setContent] = useState<WebsiteContent>(defaultHomepage);
  const [slug, setSlug] = useState("home");
  const [media, setMedia] = useState<Media[]>([]);
  const [alt, setAlt] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyEnd, setHistoryEnd] = useState(false);
  const pending = useRef(false);
  const file = useRef<HTMLInputElement>(null);
  const refresh = async () => {
    setPages(await request(`${api}/pages`));
    setMedia(await request(`${api}/media`));
  };
  useEffect(() => {
    let active = true;
    Promise.all([request(`${api}/pages`), request(`${api}/media`)])
      .then(([p, m]) => {
        if (active) {
          setPages(p);
          setMedia(m);
        }
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function edit(next: WebsiteContent) {
    setContent(next);
    setDirty(true);
  }
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action unavailable.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function load(key: string) {
    if (
      dirty &&
      !window.confirm("Discard unsaved edits and open the saved page?")
    )
      return;
    await run(async () => {
      const row = await request(`${api}/pages/${key}`);
      setHistoryEnd(false);
      setSelected(row);
      setSlug(key);
      setContent(parseContent(row.draft));
      setDirty(false);
    });
  }
  async function save() {
    await run(async () => {
      parseContent(content);
      const row = await request(`${api}/pages/${slug}`, "PUT", {
        version: selected?.version ?? 0,
        content,
      });
      setSelected(await request(`${api}/pages/${row.slug}`));
      setDirty(false);
      await refresh();
      setNotice("Draft saved. Published content is unchanged.");
    });
  }
  async function transition(action: string, revision?: number) {
    if (dirty) {
      setNotice("Save your draft before continuing.");
      return;
    }
    if (!selected) return;
    if (
      ["publish", "unpublish"].includes(action) &&
      !window.confirm(
        action === "publish"
          ? "Publish this reviewed content to the public website? Verify all claims, prices, image rights and contact details first."
          : "Remove this page's published content from the public website?",
      )
    )
      return;
    await run(async () => {
      await request(`${api}/pages/${slug}/${action}`, "POST", {
        version: selected.version,
        revision,
      });
      const row = await request(`${api}/pages/${slug}`);
      setSelected(row);
      setContent(parseContent(row.draft));
      setDirty(false);
      await refresh();
      setNotice(
        action === "rollback"
          ? "Revision restored as a draft. Submit for review before publishing."
          : `Page ${action} completed.`,
      );
    });
  }
  function section(index: number, patch: Partial<WebsiteSection>) {
    edit({
      ...content,
      sections: content.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  function move(index: number, delta: number) {
    const sections = [...content.sections];
    const next = index + delta;
    if (next < 0 || next >= sections.length) return;
    [sections[index], sections[next]] = [sections[next], sections[index]];
    edit({ ...content, sections });
  }
  function create() {
    if (dirty && !window.confirm("Discard unsaved edits and start a new page?"))
      return;
    setSelected(null);
    setSlug("new-page");
    setContent(emptyWebsitePage());
    setDirty(false);
    setNotice("");
  }
  async function upload() {
    if (!selected) {
      setNotice("Save a page draft before uploading its images.");
      return;
    }
    const image = file.current?.files?.[0];
    if (!image || !alt.trim()) {
      setNotice("Select an image and enter alternative text.");
      return;
    }
    await run(async () => {
      const data = new FormData();
      data.set("file", image);
      const r = await fetch(
        `/api/v1/documents/upload?entityType=cmsPage&entityId=${encodeURIComponent(selected.id)}`,
        {
          method: "POST",
          body: data,
          credentials: "same-origin",
          redirect: "error",
          signal: AbortSignal.timeout(30000),
        },
      );
      if (r.status === 503)
        throw new Error(
          "Uploads remain disabled until storage acceptance is approved.",
        );
      if (!r.ok)
        throw new Error(
          "Upload was not confirmed. Check the file type and your document permissions.",
        );
      const doc = await r.json();
      await request(`${api}/media`, "POST", { documentId: doc.id, alt });
      await refresh();
      if (file.current) file.current.value = "";
      setAlt("");
      setNotice(
        "Private media saved. It becomes public only when referenced by a published page.",
      );
    });
  }
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zayan-blue">
            Website management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Draft → Preview → Review → Publish. Only published snapshots reach
            the website. Publishing needs a super-admin or an approved
            cms.publish permission.
          </p>
        </div>
        <Link prefetch={false} className={button} href="/admin/leads">
          Website inquiries
        </Link>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Drafts", pages.filter((p) => p.reviewState === "DRAFT").length],
          [
            "Pending review",
            pages.filter((p) => p.reviewState === "REVIEW").length,
          ],
          ["Published", pages.filter((p) => p.status === "PUBLISHED").length],
        ].map(([label, n]) => (
          <div
            className="rounded-xl border border-line bg-white p-4"
            key={label}
          >
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold text-zayan-blue">{n}</p>
          </div>
        ))}
      </div>
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-line bg-white p-4 text-sm leading-6"
        >
          {notice}
        </p>
      )}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-line bg-white p-4">
          <h2 className="font-bold text-zayan-blue">Pages & settings</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {canEdit && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={create}
              >
                New page
              </button>
            )}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved edits?")) return;
                if (pages.some((p) => p.slug === "home")) {
                  void load("home");
                  return;
                }
                setSelected(null);
                setSlug("home");
                setContent(defaultHomepage);
                setDirty(false);
              }}
            >
              Homepage
            </button>
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => {
                if (dirty && !window.confirm("Discard unsaved edits?")) return;
                if (pages.some((p) => p.slug === "site-settings")) {
                  void load("site-settings");
                  return;
                }
                setSelected(null);
                setSlug("site-settings");
                setContent({
                  ...emptyWebsitePage("Website settings"),
                  settings: defaultWebsiteSettings,
                });
                setDirty(false);
              }}
            >
              Website settings
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-lg border border-line p-3 text-left text-sm disabled:opacity-50"
                  onClick={() => load(p.slug)}
                >
                  <span className="block font-bold">{p.slug}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {p.reviewState} · v{p.version}
                    {p.publishedVersion !== null
                      ? ` · live v${p.publishedVersion}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="rounded-xl border border-line bg-white p-5"
          >
            <h2 className="text-xl font-bold text-zayan-blue">
              {selected ? `Editing ${selected.slug}` : "Prepare a new draft"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              Use home for the homepage, site-settings for branding, or a page
              slug such as flights, about, terms or refund-policy. Other slugs
              appear at /pages/your-slug. Travel entries are grouped by
              category.
            </p>
            <fieldset disabled={busy || !canEdit} className="mt-5 space-y-5">
              <label className="block text-sm font-semibold">
                Page slug
                <input
                  className={control}
                  pattern="[a-z][a-z0-9-]{0,79}"
                  value={slug}
                  disabled={!!selected}
                  required
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label className="block text-sm font-semibold">
                Travel category
                <select
                  className={control}
                  value={content.category}
                  onChange={(e) =>
                    edit({ ...content, category: e.target.value })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Text
                label="Page / SEO title"
                value={content.title}
                onChange={(v) => edit({ ...content, title: v })}
              />
              <Text
                label="Intro / SEO description"
                value={content.summary}
                multiline
                onChange={(v) => edit({ ...content, summary: v })}
              />
              <Text
                label="Eyebrow"
                value={content.eyebrow}
                onChange={(v) => edit({ ...content, eyebrow: v })}
              />
              <Text
                label="Page text (plain text)"
                value={content.body}
                multiline
                onChange={(v) => edit({ ...content, body: v })}
              />
              <label className="block text-sm font-semibold">
                Hero image
                <select
                  className={control}
                  value={content.image}
                  onChange={(e) =>
                    edit({
                      ...content,
                      image: e.target.value,
                      imageAlt:
                        media.find(
                          (m) =>
                            `/api/public/website/media/${m.id}` ===
                            e.target.value,
                        )?.alt || "",
                    })
                  }
                >
                  <option value="">Default illustration</option>
                  {media.map((m) => (
                    <option
                      key={m.id}
                      value={`/api/public/website/media/${m.id}`}
                    >
                      {m.alt}
                    </option>
                  ))}
                </select>
              </label>
              <Text
                label="Hero alternative text"
                value={content.imageAlt}
                onChange={(v) => edit({ ...content, imageAlt: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Text
                  label="Button text"
                  value={content.actionLabel}
                  onChange={(v) => edit({ ...content, actionLabel: v })}
                />
                <Text
                  label="Button destination (public path)"
                  value={content.actionHref}
                  onChange={(v) => edit({ ...content, actionHref: v })}
                />
              </div>
              {slug === "home" && (
                <div className="space-y-3 rounded-lg border border-line p-4">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={content.searchEnabled !== false}
                      onChange={(e) =>
                        edit({ ...content, searchEnabled: e.target.checked })
                      }
                    />
                    Show inquiry search panel
                  </label>
                  <Text
                    label="Search panel label"
                    value={content.searchTitle || "Plan a travel inquiry"}
                    onChange={(v) => edit({ ...content, searchTitle: v })}
                  />
                </div>
              )}
              {content.settings && (
                <SettingsFields content={content} edit={edit} media={media} />
              )}
              <h3 className="text-lg font-bold text-zayan-blue">
                Sections in display order
              </h3>
              {content.sections.map((s, i) => (
                <fieldset
                  key={i}
                  className="space-y-4 rounded-xl border border-line bg-sky-50/50 p-4"
                >
                  <legend className="px-2 font-bold">Section {i + 1}</legend>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      onClick={() => move(i, -1)}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() => move(i, 1)}
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        edit({
                          ...content,
                          sections: content.sections.filter((_, j) => j !== i),
                        })
                      }
                    >
                      Remove section
                    </button>
                  </div>
                  <Text
                    label="Section ID"
                    value={s.id}
                    onChange={(v) => section(i, { id: v })}
                  />
                  <Text
                    label="Heading"
                    value={s.title}
                    onChange={(v) => section(i, { title: v })}
                  />
                  <Text
                    label="Description"
                    value={s.description}
                    onChange={(v) => section(i, { description: v })}
                  />
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.visible}
                      onChange={(e) =>
                        section(i, { visible: e.target.checked })
                      }
                    />
                    Show section
                  </label>
                  <label className="block text-sm font-semibold">
                    Layout
                    <select
                      className={control}
                      value={s.layout}
                      onChange={(e) =>
                        section(i, {
                          layout: e.target.value as WebsiteSection["layout"],
                        })
                      }
                    >
                      <option value="cards">Cards</option>
                      <option value="banner">Banner</option>
                      <option value="testimonials">Testimonials</option>
                    </select>
                  </label>
                  {s.cards.map((c, j) => (
                    <div
                      key={j}
                      className="space-y-3 rounded-lg border border-line bg-white p-4"
                    >
                      <Text
                        label={`Card ${j + 1} title`}
                        value={c.title}
                        onChange={(v) =>
                          section(i, {
                            cards: s.cards.map((x, k) =>
                              k === j ? { ...x, title: v } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Card text"
                        value={c.text}
                        multiline
                        onChange={(v) =>
                          section(i, {
                            cards: s.cards.map((x, k) =>
                              k === j ? { ...x, text: v } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Link text"
                        value={c.label}
                        onChange={(v) =>
                          section(i, {
                            cards: s.cards.map((x, k) =>
                              k === j ? { ...x, label: v } : x,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Public link"
                        value={c.href}
                        onChange={(v) =>
                          section(i, {
                            cards: s.cards.map((x, k) =>
                              k === j ? { ...x, href: v } : x,
                            ),
                          })
                        }
                      />
                      <label className="block text-sm font-semibold">
                        Card image
                        <select
                          className={control}
                          value={c.image}
                          onChange={(e) =>
                            section(i, {
                              cards: s.cards.map((x, k) =>
                                k === j
                                  ? {
                                      ...x,
                                      image: e.target.value,
                                      imageAlt:
                                        media.find(
                                          (m) =>
                                            `/api/public/website/media/${m.id}` ===
                                            e.target.value,
                                        )?.alt || "",
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          <option value="">No image</option>
                          {media.map((m) => (
                            <option
                              key={m.id}
                              value={`/api/public/website/media/${m.id}`}
                            >
                              {m.alt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Text
                        label="Image alternative text"
                        value={c.imageAlt}
                        onChange={(v) =>
                          section(i, {
                            cards: s.cards.map((x, k) =>
                              k === j ? { ...x, imageAlt: v } : x,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        className={button}
                        onClick={() =>
                          section(i, {
                            cards: s.cards.filter((_, k) => k !== j),
                          })
                        }
                      >
                        Remove card
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={button}
                    disabled={s.cards.length >= 12}
                    onClick={() =>
                      section(i, {
                        cards: [
                          ...s.cards,
                          {
                            title: "New card",
                            text: "",
                            image: "",
                            imageAlt: "",
                            href: "",
                            label: "",
                          },
                        ],
                      })
                    }
                  >
                    Add card
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className={button}
                disabled={content.sections.length >= 16}
                onClick={() =>
                  edit({
                    ...content,
                    sections: [
                      ...content.sections,
                      {
                        id: `section-${Date.now()}`,
                        title: "New section",
                        description: "",
                        visible: true,
                        layout: "cards",
                        cards: [],
                      },
                    ],
                  })
                }
              >
                Add section
              </button>
              <div>
                <button className="website-cta" type="submit">
                  Save draft
                </button>
              </div>
            </fieldset>
          </form>
          <div className="flex flex-wrap gap-3">
            {selected && (
              <>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => load(selected.slug)}
                >
                  Reload saved page
                </button>
                <Link
                  prefetch={false}
                  className={button}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`/admin/website/preview/${selected.slug}`}
                >
                  Preview saved draft ↗
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy || dirty}
                    onClick={() => transition("review")}
                  >
                    Submit for review
                  </button>
                )}
                {canPublish && (
                  <>
                    <button
                      type="button"
                      className="website-cta"
                      disabled={
                        busy || dirty || selected.reviewState !== "REVIEW"
                      }
                      onClick={() => transition("publish")}
                    >
                      Publish reviewed content
                    </button>
                    <button
                      type="button"
                      className={button}
                      disabled={busy || selected.status !== "PUBLISHED"}
                      onClick={() => transition("unpublish")}
                    >
                      Unpublish
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          {selected?.revisions && (
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="text-xl font-bold text-zayan-blue">
                Revision history
              </h2>
              <p className="mt-2 text-sm text-muted">
                Restoring creates a new draft; review and publishing are still
                required.
              </p>
              <ul className="mt-4 space-y-3">
                {selected.revisions.map((r) => (
                  <li
                    key={r.version}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      v{r.version} · {r.action} ·{" "}
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        className={button}
                        disabled={busy || dirty}
                        onClick={() => transition("rollback", r.version)}
                      >
                        Restore as draft
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {selected.revisions.length >= 40 && !historyEnd && (
                <button
                  type="button"
                  className={`${button} mt-4`}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const last =
                        selected.revisions![selected.revisions!.length - 1]
                          .version;
                      const older = await request(
                        `${api}/pages/${slug}/revisions?before=${last}`,
                      );
                      setSelected({
                        ...selected,
                        revisions: [...selected.revisions!, ...older],
                      });
                      setHistoryEnd(older.length < 40);
                    })
                  }
                >
                  Show older revisions
                </button>
              )}
            </section>
          )}
          <section className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-xl font-bold text-zayan-blue">Media library</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Use only approved public website images. Never upload passports,
              customer records or private documents here. Production uploads
              remain gated by storage acceptance. Removing an unused library
              entry retains its private storage object.
            </p>
            {canEdit && (
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-semibold">
                  JPEG, PNG or WebP image
                  <input
                    ref={file}
                    className={control}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                  />
                </label>
                <Text
                  label="Image description / alternative text"
                  value={alt}
                  onChange={setAlt}
                />
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={upload}
                >
                  Upload private image
                </button>
              </div>
            )}
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {media.map((m) => (
                <li key={m.id} className="rounded-lg border border-line p-3">
                  <Image
                    unoptimized
                    src={`${api}/media/${m.id}/preview`}
                    alt={m.alt}
                    width={240}
                    height={140}
                    className="h-32 w-full object-contain"
                    loading="lazy"
                  />
                  <p className="mt-2 text-sm">{m.alt}</p>
                  {canEdit && (
                    <button
                      type="button"
                      className={`${button} mt-3`}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await request(`${api}/media/${m.id}`, "DELETE");
                          await refresh();
                          setNotice(
                            "Library entry removed; private object retained.",
                          );
                        })
                      }
                    >
                      Remove unused entry
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
function SettingsFields({
  content,
  edit,
  media,
}: {
  content: WebsiteContent;
  edit: (c: WebsiteContent) => void;
  media: Media[];
}) {
  const s = content.settings!;
  const set = (key: string, value: unknown) =>
    edit({ ...content, settings: { ...s, [key]: value } });
  return (
    <fieldset className="space-y-4 rounded-xl border border-line p-4">
      <legend className="font-bold">Branding & contact settings</legend>
      {(
        [
          ["companyName", "Company name"],
          ["tagline", "Tagline"],
          ["email", "Email"],
          ["address", "Address"],
          ["whatsapp", "WhatsApp international digits"],
          ["announcement", "Announcement"],
          ["seoTitle", "SEO default title"],
          ["seoDescription", "SEO default description"],
        ] as const
      ).map(([key, label]) => (
        <Text
          key={key}
          label={label}
          value={s[key]}
          onChange={(v) => set(key, v)}
        />
      ))}
      <Text
        label="Phone numbers, separated by commas"
        value={s.phones.join(", ")}
        onChange={(v) =>
          set(
            "phones",
            v.split(",").map((p) => p.trim()),
          )
        }
      />
      <label className="block text-sm font-semibold">
        Approved logo
        <select
          className={control}
          value={s.logo}
          onChange={(e) => {
            const m = media.find(
              (m) => `/api/public/website/media/${m.id}` === e.target.value,
            );
            edit({
              ...content,
              settings: { ...s, logo: e.target.value, logoAlt: m?.alt || "" },
            });
          }}
        >
          <option value="">Keep existing text/monogram</option>
          {media.map((m) => (
            <option key={m.id} value={`/api/public/website/media/${m.id}`}>
              {m.alt}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["nav", "Navigation"],
          ["social", "Social links"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <h3 className="font-bold">{label}</h3>
          {s[key].map((n, i) => (
            <div
              key={i}
              className="my-3 grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2"
            >
              <Text
                label="Label"
                value={n.label}
                onChange={(v) =>
                  set(
                    key,
                    s[key].map((x, j) => (j === i ? { ...x, label: v } : x)),
                  )
                }
              />
              <Text
                label={key === "social" ? "HTTPS destination" : "Public path"}
                value={n.href}
                onChange={(v) =>
                  set(
                    key,
                    s[key].map((x, j) => (j === i ? { ...x, href: v } : x)),
                  )
                }
              />
              <button
                type="button"
                className={button}
                onClick={() =>
                  set(
                    key,
                    s[key].filter((_, j) => j !== i),
                  )
                }
              >
                Remove link
              </button>
            </div>
          ))}
          <button
            type="button"
            className={button}
            onClick={() =>
              set(key, [...s[key], { label: "New link", href: "" }])
            }
          >
            Add link
          </button>
        </div>
      ))}
    </fieldset>
  );
}
