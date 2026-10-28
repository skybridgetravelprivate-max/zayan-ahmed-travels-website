import { getWebsitePage } from "@/server/website-content";
import { WebsiteView } from "@/components/website/WebsiteView";
import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { site } from "@/config/site";
import {
  getPublicCompanyProfile,
  type PublicCompanyProfile,
} from "@/server/crm-company";

const fallbackMetadata: Metadata = {
  title: "Contact",
  description: `Contact ${site.legalName}. The form is checked on this website, then sent to the travel desk.`,
};

const missing = "Not listed in the site configuration.";

function published(value: string) {
  return value.trim() || missing;
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function phoneHref(value: string) {
  return /^[+()\d][\d\s().-]{5,39}$/.test(value)
    ? `tel:${value.replace(/[^\d+]/g, "")}`
    : "";
}

function whatsappHref(value: string) {
  const siteUrl = safeHttpUrl(value);
  if (siteUrl) {
    const url = new URL(siteUrl);
    if (url.hostname === "wa.me" || url.hostname === "api.whatsapp.com")
      return url.href;
    return "";
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15
    ? `https://wa.me/${digits}`
    : "";
}

function ContactValue({ value, href }: { value: string; href?: string }) {
  const text = published(value);
  if (!value.trim() || !href) return text;
  return (
    <a className="text-zayan-blue hover:text-zayan-orange" href={href}>
      {text}
    </a>
  );
}

function companyRows(profile: PublicCompanyProfile) {
  const website = safeHttpUrl(profile.website);
  return [
    { label: "Name", value: profile.companyName, href: "" },
    ...(profile.phones || [profile.phone]).map((phone, index) => ({
      label: index ? "Other phone" : "Phone",
      value: phone,
      href: phoneHref(phone),
    })),
    {
      label: "Email",
      value: profile.email,
      href: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
        ? `mailto:${profile.email}`
        : "",
    },
    { label: "Website", value: profile.website, href: website },
    { label: "Address", value: profile.address, href: "" },
    {
      label: "WhatsApp",
      value: profile.whatsapp,
      href: whatsappHref(profile.whatsapp),
    },
  ].filter((row) => row.value.trim().length > 0);
}

export default async function ContactPage() {
  const publishedWebsitePage = await getWebsitePage("contact");

  const profile = await getPublicCompanyProfile();

  return (
    <>
      {publishedWebsitePage ? (
        <WebsiteView content={publishedWebsitePage.content} />
      ) : (
        <section className="bg-zayan-blue text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <p className="text-sm font-semibold tracking-wide text-orange-300 uppercase">
              {profile.companyName}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Contact
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/85">
              {site.tagline}. The form is checked on this website, then sent to
              the travel desk. It is not emailed from this page.
            </p>
          </div>
        </section>
      )}

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-xl font-bold text-zayan-blue">Company</h2>
            <dl className="mt-6 space-y-5 text-sm">
              {companyRows(profile).map((row) => (
                <div key={row.label}>
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="mt-1 font-semibold break-words text-foreground">
                    <ContactValue value={row.value} href={row.href} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-xl font-bold text-zayan-blue">Message</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Name, email, phone, subject, and message are checked here, then
              sent to the travel desk.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export async function generateMetadata() {
  const page = await getWebsitePage("contact");
  return page
    ? { title: page.content.title, description: page.content.summary }
    : fallbackMetadata;
}
