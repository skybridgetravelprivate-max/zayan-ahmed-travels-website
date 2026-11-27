import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { AccountingReports } from "@/components/admin/AccountingReports";

export const metadata = { title: "Accounting reports", robots: { index: false, follow: false } };

export default async function ReportsPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  if (!identity.user.isSuperAdmin) return <p role="alert">Global reports require Super Admin access.</p>;
  return <AccountingReports />;
}
