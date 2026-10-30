import type { ManagementModule } from "./staff-management";
import { workflowsFor } from "./staff-workflows";
export function moduleHref(key: string) {
  return key === "cms-pages"
    ? "/admin/website"
    : key === "umrah-packages"
      ? "/admin/manage/umrah-packages/catalog"
      : `/admin/manage/${key}`;
}
export function moduleCapabilities(
  module: ManagementModule,
  permissions: string[],
  superAdmin: boolean,
) {
  if (module.key === "cms-pages")
    return [
      "View website pages",
      ...(superAdmin || permissions.includes("cms.edit")
        ? ["edit drafts"]
        : []),
      ...(superAdmin || permissions.includes("cms.publish")
        ? ["publish reviewed content"]
        : []),
    ].join(" · ");
  const actions = [
    ...workflowsFor(module.key, false, permissions, superAdmin),
    ...workflowsFor(module.key, true, permissions, superAdmin),
  ];
  const parts = [
    "View and search",
    ...(module.canCreate ? ["create records"] : []),
    ...(module.canEdit ? ["edit permitted fields"] : []),
  ];
  if (actions.length)
    parts.push(...actions.map((action) => action.label.toLowerCase()));
  return parts.join(" · ");
}
export function navigationGroup(group: string) {
  return ["Travel", "Hotels", "Flights", "Transport", "Partners"].includes(
    group,
  )
    ? "Travel operations"
    : group;
}
