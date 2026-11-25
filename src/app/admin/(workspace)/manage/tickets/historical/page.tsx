import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { HistoricalTickets } from "@/components/admin/HistoricalTickets";

export const metadata: Metadata = { title: "Historical supplier tickets", robots: { index: false, follow: false } };
export default async function HistoricalTicketPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login/super-admin");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  if (!identity.user.isSuperAdmin) return <p role="alert">Historical supplier records require Super Admin access.</p>;
  return <HistoricalTickets />;
}
