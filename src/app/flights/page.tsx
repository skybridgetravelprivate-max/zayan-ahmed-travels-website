import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.flights.title, description: servicePages.flights.intro };
export default function Page() { return <ServiceLanding service="flights" />; }
