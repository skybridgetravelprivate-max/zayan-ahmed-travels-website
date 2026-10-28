import { getStaffIdentity } from "@/server/staff-api";
import { WebsiteWorkspace } from "@/components/admin/WebsiteWorkspace";
export const metadata = {
  title: "Website management",
  robots: { index: false, follow: false },
};
export default async function WebsiteAdmin() {
  const identity = await getStaffIdentity();
  if (identity.status !== "authenticated") return null;
  const u = identity.user;
  if (!u.isSuperAdmin && !u.permissions.includes("cms.view"))
    return <p>You do not have permission to view website content.</p>;
  return (
    <WebsiteWorkspace
      canEdit={u.isSuperAdmin || u.permissions.includes("cms.edit")}
      canPublish={u.isSuperAdmin || u.permissions.includes("cms.publish")}
    />
  );
}
