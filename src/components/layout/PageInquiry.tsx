import { ServiceInquiryForm } from "@/components/forms/ServiceInquiryForm";
import { DemoStatusButton } from "@/components/layout/DemoStatusButton";
import type { InquiryType } from "@/lib/inquiries";

type PageInquiryProps = {
  title: string;
  body: string;
  buttonLabel: string;
  status: string;
  inquiryType?: InquiryType;
};

export function PageInquiry({ title, body, buttonLabel, status, inquiryType }: PageInquiryProps) {
  return (
    <section
      id="inquiry"
      className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        <p className="max-w-2xl text-base leading-7 text-white/85">{body}</p>
        {inquiryType ? (
          <ServiceInquiryForm type={inquiryType} submitLabel={buttonLabel} />
        ) : (
          <DemoStatusButton label={buttonLabel} status={status} />
        )}
      </div>
    </section>
  );
}
