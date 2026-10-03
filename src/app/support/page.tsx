import type { Metadata } from "next";
import { InfoHero, InfoSection } from "@/components/layout/InfoPage";
import { Button } from "@/components/ui/Button";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Support",
  description: `Support notes for ${site.legalName} Questions on this page are samples.`,
};

const questions = [
  {
    question: "Where do I ask about a demo booking card?",
    answer:
      "Use the contact page. The form is checked there, then sent to the travel desk.",
  },
  {
    question: "Are the prices on this website live?",
    answer:
      "No. Fares, nightly rates, and fees on this site are labelled as demo figures.",
  },
  {
    question: "Can I file a visa from the visa page?",
    answer:
      "No. Visa cards are sample categories. The View visa button opens a sample page and does not submit an application.",
  },
  {
    question: "Is the account page a real sign-in?",
    answer:
      "No. The account and booking screens use sample profiles and sample cards only.",
  },
] as const;

export default function SupportPage() {
  return (
    <>
      <InfoHero
        title="Support"
        intro={`${site.shortName} can point you to the public pages on this site. The questions below are demo text, not a live help desk.`}
      />
      <InfoSection title="Sample questions">
        <ul className="space-y-3">
          {questions.map((item) => (
            <li key={item.question}>
              <details className="rounded-2xl border border-line bg-surface p-4">
                <summary className="cursor-pointer rounded-sm font-semibold text-zayan-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zayan-blue">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </InfoSection>
      <section className="bg-zayan-blue px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
          <h2 className="text-3xl font-bold tracking-tight">Contact {site.shortName}</h2>
          <p className="text-base leading-7 text-white/85">
            The contact page lists the company details that are published.
            Blank address and email fields stay unmarked until a value is available.
          </p>
          <Button href="/contact">Contact us</Button>
        </div>
      </section>
    </>
  );
}
