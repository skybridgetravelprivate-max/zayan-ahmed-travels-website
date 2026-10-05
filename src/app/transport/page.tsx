import type { Metadata } from "next";
import { PlaceholderArt } from "@/components/home/PlaceholderArt";
import { PageInquiry } from "@/components/layout/PageInquiry";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { site } from "@/config/site";
import { transportServices } from "@/config/transport";

export const metadata: Metadata = {
  title: "Transport",
  description: `Demo transport services for ${site.legalName}. Sample rides only.`,
};

export default function TransportPage() {
  return (
    <>
      <section className="bg-zayan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-zayan-orange uppercase">
            {site.legalName}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Transport
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/85">
            Sample rides for airport transfers, private cars, coasters and buses,
            and Umrah transport. Nothing on this page is reserved.
          </p>
          <Button href="#inquiry" variant="inverse">
            Ask about transport
          </Button>
        </div>
      </section>

      <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold tracking-tight text-zayan-blue sm:text-3xl">
            Demo services
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Four sample services. Vehicles and timings are not live.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {transportServices.map((service) => (
              <li key={service.id}>
                <Card
                  title={service.title}
                  description={service.description}
                  media={<PlaceholderArt caption={service.title} tone={service.tone} />}
                >
                  <p className="text-sm font-semibold text-foreground">{service.detail}</p>
                  <p className="mt-3 text-xs font-semibold tracking-wide text-zayan-orange uppercase">
                    Demo service
                  </p>
                  <Button className="mt-4" href={`/transport/${service.id}`}>
                    View service
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
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
