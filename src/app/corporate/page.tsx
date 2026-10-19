import type { Metadata } from "next";
import { ServiceLanding } from "@/components/layout/ServiceLanding";
import { servicePages } from "@/config/service-pages";
export const metadata: Metadata = { title: servicePages.corporate.title, description: servicePages.corporate.intro };
export default function Page() { return <ServiceLanding service="corporate" />; }
