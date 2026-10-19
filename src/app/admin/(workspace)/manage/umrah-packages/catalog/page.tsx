import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffIdentity } from "@/server/staff-api";
import { UmrahCatalog } from "@/components/admin/UmrahCatalog";

export const metadata: Metadata = { title: "Umrah groups & packages", robots: { index: false, follow: false } };
export default async function UmrahCatalogPage() {
  const identity = await getStaffIdentity();
  if (identity.status === "signed-out") redirect("/admin/login");
  if (identity.status !== "authenticated") return <p role="alert">Staff session could not be verified.</p>;
  if (!identity.user.isSuperAdmin && !identity.user.permissions.includes("umrah.view")) return <p role="alert">You do not have permission to view Umrah packages.</p>;
  return <UmrahCatalog />;
}
