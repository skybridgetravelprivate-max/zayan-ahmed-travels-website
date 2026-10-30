import { ManagementHub } from "@/components/admin/ManagementWorkspace";
import { getStaffIdentity } from "@/server/staff-api";
import { redirect } from "next/navigation";
export const metadata = {
  title: "Management",
  robots: { index: false, follow: false },
};
export default async function ManagementPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated")
    return <p role="alert">Staff session could not be verified.</p>;
  return (
    <ManagementHub
      permissions={identity.user.permissions}
      isSuperAdmin={identity.user.isSuperAdmin}
    />
  );
}
