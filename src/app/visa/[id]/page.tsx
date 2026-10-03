import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { VisaInquiry } from "@/components/visa/VisaInquiry";
import { Button } from "@/components/ui/Button";
import { demoVisas, formatDemoFee, getDemoVisa } from "@/config/visa";
import { site } from "@/config/site";

type VisaPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return demoVisas.map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: VisaPageProps): Promise<Metadata> {
  const { id } = await params;
  const visa = getDemoVisa(id);

  if (!visa) {
    return { title: "Visa" };
  }

  return {
    title: `${visa.destination} ${visa.type} visa`,
    description: `Demo ${visa.type} visa category for ${visa.destination}. ${site.shortName}. This is not an application.`,
  };
}

export default async function VisaDetailPage({ params }: VisaPageProps) {
  const { id } = await params;
  const visa = getDemoVisa(id);

  if (!visa) {
    notFound();
  }

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo visa
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            {visa.destination}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample {visa.type} visa information. This page does not submit an application or grant approval.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#inquiry">Start an inquiry</Button>
            <Button href="/visa#categories" variant="inverse">
              Back to categories
            </Button>
          </div>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl">
              <PlaceholderArt caption={visa.destination} tone={visa.tone} />
            </div>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Description</h2>
              <p className="mt-3 text-base leading-7 text-muted">{visa.description}</p>
            </section>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Requirements summary</h2>
              <p className="mt-3 text-base leading-7 text-muted">{visa.requirements}</p>
            </section>
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo category
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="text-muted">Destination</dt>
                <dd className="mt-1 font-semibold text-foreground">{visa.destination}</dd>
              </div>
              <div>
                <dt className="text-muted">Visa type</dt>
                <dd className="mt-1 font-semibold text-foreground">{visa.type}</dd>
              </div>
              <div>
                <dt className="text-muted">Demo fee</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatDemoFee(visa.fee)}</dd>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sample figure only. This is not an official government fee.
                </p>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <VisaInquiry />
    </>
  );
}
