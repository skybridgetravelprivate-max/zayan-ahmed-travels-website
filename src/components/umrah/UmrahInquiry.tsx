import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { site } from "@/config/site";

export function UmrahInquiry() {
  return (
    <section
      id="inquiry"
      className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to ask about Umrah?
        </h2>
        <p className="max-w-2xl text-base leading-7 text-white/85">
          Ask {site.legalName} about your preferred dates, hotels and room arrangements.
          Your inquiry is sent to the travel desk; it does not confirm a booking.
        </p>
        <ServiceInquiryForm type="umrah" submitLabel="Send Umrah inquiry" />
      </div>
    </section>
  );
}
