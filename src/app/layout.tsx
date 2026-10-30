import type { ReactNode } from "react";
import { getWebsiteSettings } from "@/server/website-content";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { SiteNotice } from "@/components/layout/SiteNotice";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  allowSearchIndexing,
  site,
  siteDescription,
  siteOrigin,
} from "@/config/site";
import { siteGraph } from "@/lib/structured-data";
import "./globals.css";

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "400 700",
  display: "swap",
});

const indexingAllowed = allowSearchIndexing();

const defaultMetadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: site.legalName,
    template: `%s | ${site.shortName}`,
  },
  description: siteDescription,
  applicationName: site.shortName,
  authors: [{ name: site.legalName }],
  creator: site.legalName,
  publisher: site.legalName,
  alternates: {
    canonical: "./",
  },
  robots: indexingAllowed
    ? { index: true, follow: true }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: site.legalName,
    url: "./",
    locale: "en",
  },
  twitter: {
    card: "summary",
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const settings = await getWebsiteSettings();
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <SiteChrome
          header={<Header settings={settings} />}
          footer={<Footer settings={settings} />}
          notice={<SiteNotice />}
          structuredData={<JsonLd data={siteGraph(settings)} />}
          contact={<WhatsAppButton settings={settings} />}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getWebsiteSettings();
  return {
    ...defaultMetadata,
    title: {
      default: s.seoTitle || s.companyName,
      template: `%s | ${s.companyName}`,
    },
    description: s.seoDescription,
  };
}
