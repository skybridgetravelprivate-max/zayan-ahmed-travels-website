import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.hotels.title, description: servicePages.hotels.intro };
export default function Page() { return <ServiceLanding service="hotels" />; }
