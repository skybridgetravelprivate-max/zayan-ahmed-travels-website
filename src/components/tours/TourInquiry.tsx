import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { site } from "@/config/site";

export function TourInquiry() {
  return (
    <section
      id="inquiry"
      className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ask about a tour
        </h2>
        <p className="max-w-2xl text-base leading-7 text-white/85">
          {site.legalName} can walk through a sample itinerary with you. This
          inquiry is checked on the website, then sent to the travel desk. It
          does not book a tour.
        </p>
        <ServiceInquiryForm type="tour" submitLabel="Send tour inquiry" />
      </div>
    </section>
  );
}
