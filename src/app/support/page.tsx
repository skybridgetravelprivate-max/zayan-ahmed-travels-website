import type { Metadata } from "next";
import Link from "next/link";
import { InfoHero, InfoSection } from "@/components/layout/InfoPage";
export const metadata: Metadata = { title: "Travel support", description: "Help with travel inquiries, website accounts and linked bookings." };
const questions = [
  ["How do I request a quotation?", "Use the relevant service inquiry form or contact the travel desk. Include your route, dates, travellers and preferences. Sending an inquiry does not reserve services."],
  ["Where can I see my bookings?", "Sign in to your website account and open My bookings. Only bookings linked to that account are available there. Contact the desk if a booking needs to be linked."],
  ["Are website inquiries and staff accounts the same?", "No. Customers use the account page; authorised staff use the separate staff sign-in. Public inquiry messages go to the travel desk."],
  ["Can I upload travel documents?", "Document uploads are currently unavailable. Contact the desk for an approved way to provide documents; do not paste passport or payment details into inquiry messages."],
  ["Does a visa inquiry submit an application?", "No. It requests assistance from the travel desk. Requirements and the application process must be confirmed for your circumstances."],
];
export default function SupportPage() {
  return <><InfoHero title="How can we help?" intro="Find help with planning, website access and your existing trip." /><InfoSection title="Common questions"><div className="space-y-3">{questions.map(([title, answer]) => <details key={title} className="rounded-xl border border-line bg-surface p-5"><summary className="cursor-pointer font-semibold text-zayan-blue">{title}</summary><p className="mt-3">{answer}</p></details>)}</div><Link className="inline-block font-semibold text-zayan-blue underline" href="/contact">Contact the travel desk</Link></InfoSection></>;
}
