import { AgencyWorkspace } from "@/components/agency/AgencyWorkspace";
import Link from "next/link";
export const metadata = { title: "Agent workspace", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AgentPage() {
  if (process.env.AGENT_PORTAL_ENABLED !== "true") return <section className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-bold">Agent access is not activated</h1><Link className="mt-5 inline-block underline" href="/contact">Contact the travel desk</Link></section>;
  return <AgencyWorkspace />;
}
