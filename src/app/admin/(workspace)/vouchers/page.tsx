import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { JournalVoucher } from "@/components/admin/JournalVoucher";

export const metadata = { title: "Journal voucher", robots: { index: false, follow: false } };
export default async function VoucherPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  if (!identity.user.isSuperAdmin) return <p role="alert">Journal posting requires Super Admin access.</p>;
  return <JournalVoucher username={identity.user.username} />;
}
