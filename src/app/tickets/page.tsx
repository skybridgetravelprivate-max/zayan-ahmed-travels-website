import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.tickets.title, description: servicePages.tickets.intro };
export default function Page() { return <ServiceLanding service="tickets" />; }
