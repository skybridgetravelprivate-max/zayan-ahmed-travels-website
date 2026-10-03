import { DemoStatusButton } from "@/components/layout/DemoStatusButton";

export function HotelInquiry({ hotelName }: { hotelName: string }) {
  return (
    <section id="inquiry" className="scroll-mt-24 bg-zayan-blue px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          Ask about {hotelName}
        </h2>
        <p className="max-w-2xl text-base leading-7 text-white/85">
          This inquiry stays on the page. It does not check a room, send a message, or take payment.
        </p>
        <DemoStatusButton label="Ask about this stay" status="Demo only. Nothing was sent or reserved." />
      </div>
    </section>
  );
}
