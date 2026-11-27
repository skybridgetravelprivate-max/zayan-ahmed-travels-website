import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { ServiceInvoices } from "@/components/admin/ServiceInvoices";
export const metadata = { title: "General and quick invoices", robots: { index: false, follow: false } };
export default async function InvoicesPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  if (!identity.user.isSuperAdmin) return <p role="alert">Global invoices require Super Admin access.</p>;
  return <ServiceInvoices username={identity.user.username} />;
}
