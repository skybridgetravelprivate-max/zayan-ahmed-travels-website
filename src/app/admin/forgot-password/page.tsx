import type { Metadata } from "next";
import { StaffRecoveryForm } from "@/components/admin/StaffRecoveryForm";
export const metadata: Metadata = { title: "Staff password recovery", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function ForgotStaffPassword() {
  const agentEnabled = process.env.AGENT_PORTAL_ENABLED === "true";
  return <section className="mx-auto max-w-lg px-4 py-12"><h1 className="text-3xl font-bold">{agentEnabled ? "Staff and Agent password recovery" : "Staff password recovery"}</h1><p className="mt-3">Recover access to an existing staff or approved agency account. Email delivery requires configured SMTP. Website customers use the customer account portal.</p><StaffRecoveryForm agentEnabled={agentEnabled} /></section>;
}
