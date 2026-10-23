import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.insurance.title, description: servicePages.insurance.intro };
export default function Page() { return <ServiceLanding service="insurance" />; }
