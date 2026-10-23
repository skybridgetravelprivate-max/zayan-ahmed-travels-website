import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.offers.title, description: servicePages.offers.intro };
export default function Page() { return <ServiceLanding service="offers" />; }
