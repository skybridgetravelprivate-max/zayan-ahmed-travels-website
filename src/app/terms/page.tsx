import type { Metadata } from "next";
import { InfoHero, InfoSection, Placeholder } from "@/components/layout/InfoPage";
import { site } from "@/config/site";
import { getPublishedTermsPage } from "@/server/crm-terms";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms for ${site.legalName}`,
};

function TermsPlaceholder() {
  return (
    <>
      <InfoHero
        title="Terms"
        intro={`These headings outline how terms for ${site.legalName} will be written. The text below is a placeholder, not a binding agreement.`}
      />
      <InfoSection title="General website terms">
        <Placeholder>
          <p>
            This website presents sample pages for flights, stays, Umrah, visas,
            tours, and related services. A final term will say how the pages may
            be used. That wording is not written yet.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Travel and service disclaimer">
        <Placeholder>
          <p>
            Demo cards, prices, and articles on this site are not live offers and
            do not confirm a seat, room, visa, or departure. A final disclaimer
            will replace this note.
          </p>
        </Placeholder>
      </InfoSection>
      <InfoSection title="Booking and payment terms">
        <Placeholder>
          <p>
            Booking and payment terms are not published yet. This page does not
            state fees, due dates, or how a payment would be taken.
          </p>
        </Placeholder>
      </InfoSection>
    </>
  );
}

export default async function TermsPage() {
  const page = await getPublishedTermsPage();
  if (!page) return <TermsPlaceholder />;

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{page.title}</h1>
        </div>
      </section>
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-base leading-7 whitespace-pre-wrap text-foreground">{page.body}</p>
        </div>
      </section>
    </>
  );
}
