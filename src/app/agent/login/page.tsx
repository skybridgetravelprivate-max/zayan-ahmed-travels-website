import Link from "next/link";
import { StaffLoginForm } from "@/components/admin/StaffSessionForm";
export const metadata = { title: "Agent sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AgentLogin() {
  const enabled = process.env.AGENT_PORTAL_ENABLED === "true";
  return <section className="mx-auto max-w-lg px-5 py-12"><Link href="/" className="underline">Zayan Ahmed Travels</Link><h1 className="mt-6 text-3xl font-bold text-zayan-blue">Agent sign in</h1><p className="mt-3">For approved external agency users. Staff and customer accounts use their separate portals.</p>{enabled ? <StaffLoginForm portal="agent" label="Agent" /> : <p role="status" className="mt-6 rounded-xl border border-line p-5">Agent access is not activated. Contact the travel desk for assistance.</p>}<div className="mt-6 flex flex-wrap gap-5"><Link href="/admin/forgot-password" className="underline">Forgot password?</Link><Link href="/admin/login" className="underline">Staff access</Link><Link href="/account" className="underline">Customer account</Link></div></section>;
}
