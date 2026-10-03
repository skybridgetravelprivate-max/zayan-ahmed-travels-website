import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { PageInquiry } from "@/components/layout/PageInquiry";
import { Button } from "@/components/ui/Button";
import { getTransportService, transportServices } from "@/config/transport";
import { site } from "@/config/site";

type TransportPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return transportServices.map((service) => ({ id: service.id }));
}

export async function generateMetadata({ params }: TransportPageProps): Promise<Metadata> {
  const { id } = await params;
  const service = getTransportService(id);

  if (!service) {
    return { title: "Transport" };
  }

  return {
    title: service.title,
    description: `Demo ${service.title} service. ${site.shortName}. No vehicle is reserved.`,
  };
}

export default async function TransportDetailPage({ params }: TransportPageProps) {
  const { id } = await params;
  const service = getTransportService(id);

  if (!service) {
    notFound();
  }

  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            Demo service
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">{service.title}</h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample transport service. This page does not reserve a vehicle.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="#inquiry">Start an inquiry</Button>
            <Button href="/transport" variant="inverse">
              Back to transport
            </Button>
          </div>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-8">
            <div className="overflow-hidden rounded-3xl">
              <PlaceholderArt caption={service.title} tone={service.tone} />
            </div>
            <section>
              <h2 className="text-2xl font-bold tracking-tight text-zayan-blue">Description</h2>
              <p className="mt-3 text-base leading-7 text-muted">{service.description}</p>
            </section>
          </div>
          <aside className="h-fit rounded-3xl border border-line bg-surface p-6">
            <p className="text-xs font-semibold tracking-wide text-zayan-orange uppercase">
              Demo service
            </p>
            <dl className="mt-5 space-y-5 text-sm">
              <div>
                <dt className="text-muted">Service name</dt>
                <dd className="mt-1 font-semibold text-foreground">{service.title}</dd>
              </div>
              <div>
                <dt className="text-muted">Service type</dt>
                <dd className="mt-1 font-semibold text-foreground">{service.title}</dd>
              </div>
              <div>
                <dt className="text-muted">Sample detail</dt>
                <dd className="mt-1 font-semibold text-foreground">{service.detail}</dd>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Sample note only. This record has no price, vehicle, or schedule.
                </p>
              </div>
            </dl>
          </aside>
        </div>
      </div>

      <PageInquiry
        title="Ask about a ride"
        body={`${site.legalName} can talk through a sample transfer with you. This inquiry is checked on the website, then sent to the travel desk. It does not reserve a ride.`}
        buttonLabel="Start an inquiry"
        inquiryType="transport"
        status="The transport inquiry could not be received. Try again later."
      />
    </>
  );
}
