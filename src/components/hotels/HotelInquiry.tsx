import { Button } from "@/components/ui/Button";

export function HotelInquiry({ hotelName }: { hotelName: string }) {
  return (
    <section id="inquiry" className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Hotel enquiry
        </h2>
        <p className="max-w-2xl text-base leading-7 text-white/85">
          {hotelName} is a sample listing. This page does not check rooms or
          reserve stays. Use the contact form to send a general hotel enquiry.
        </p>
        <Button href="/contact" variant="inverse">
          Open contact form
        </Button>
      </div>
    </section>
  );
}
