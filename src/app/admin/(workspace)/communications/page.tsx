import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { CommunicationRecovery } from "@/components/admin/CommunicationRecovery";

export const metadata = {
  title: "Communication recovery",
  robots: { index: false, follow: false },
};

export default async function CommunicationRecoveryPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated")
    return <p role="alert">Staff session could not be verified.</p>;
  return (
    <CommunicationRecovery
      key={identity.user.username}
      username={identity.user.username}
      canReconcile={identity.user.isSuperAdmin}
    />
  );
}
