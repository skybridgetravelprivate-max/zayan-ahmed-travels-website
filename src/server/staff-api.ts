import "server-only";
import { cookies } from "next/headers";

export type StaffIdentity = {
  fullName: string;
  username: string;
  roleNames: string[];
  permissions: string[];
  isSuperAdmin: boolean;
};
export type StaffResult =
  | { status: "signed-out" | "unavailable" }
  | { status: "authenticated"; user: StaffIdentity };
export type StaffApiPath =
  | "/api/auth/me"
  | "/api/v1/dashboard/summary"
  | "/api/v1/dashboard/workspace"
  | "/api/v1/management/modules"
  | "/api/v1/crm/today"
  | `/api/v1/management/issued-ticket-invoices?${string}`
  | `/api/v1/leads${string}`
  | `/api/v1/website/pages${string}`;

const leadApiPath =
  /^\/api\/v1\/leads(?:\/[A-Za-z0-9_-]{1,80})?(?:\?[A-Za-z0-9%&=._~+-]*)?$/;

export function parseStaffIdentity(value: unknown): StaffIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string");
  if (
    typeof row.fullName !== "string" ||
    typeof row.username !== "string" ||
    typeof row.isSuperAdmin !== "boolean" ||
    !strings(row.roleNames) ||
    !strings(row.permissions)
  )
    return null;
  return {
    fullName: row.fullName,
    username: row.username,
    roleNames: row.roleNames,
    permissions: row.permissions,
    isSuperAdmin: row.isSuperAdmin,
  };
}

export async function staffRequest(path: StaffApiPath) {
  if (
    path !== "/api/auth/me" &&
    path !== "/api/v1/dashboard/summary" &&
    path !== "/api/v1/dashboard/workspace" &&
    path !== "/api/v1/management/modules" &&
    path !== "/api/v1/crm/today" &&
    !(path.length <= 5000 && /^\/api\/v1\/management\/issued-ticket-invoices\?[A-Za-z0-9%&=._~*+-]*$/.test(path)) &&
    (path.length > 600 ||
      (!leadApiPath.test(path) &&
        !/^\/api\/v1\/website\/pages(?:\/[a-z][a-z0-9-]{0,79})?$/.test(path)))
  ) {
    throw new Error("Invalid staff API path");
  }
  const token = (await cookies()).get("access_token")?.value;
  if (!token || !/^[A-Za-z0-9._~-]+$/.test(token)) return null;
  const origin = new URL(
    process.env.API_URL || process.env.CRM_API_URL || "http://127.0.0.1:4000",
  );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" && !(local && origin.protocol === "http:"))
  )
    throw new Error("Invalid staff API configuration");
  return fetch(new URL(path, origin.origin), {
    headers: { Cookie: `access_token=${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
}

export async function getStaffIdentity(
  request = staffRequest,
): Promise<StaffResult> {
  try {
    const response = await request("/api/auth/me");
    if (!response || response.status === 401) return { status: "signed-out" };
    if (!response.ok) return { status: "unavailable" };
    const user = parseStaffIdentity(await response.json());
    return user ? { status: "authenticated", user } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function getStaffModules() {
  const response = await staffRequest("/api/v1/management/modules");
  if (!response?.ok) throw new Error("Staff modules unavailable");
  const modules: unknown = await response.json();
  if (
    !Array.isArray(modules) ||
    modules.some(
      (m) =>
        !m ||
        typeof m.key !== "string" ||
        !/^[a-z-]+$/.test(m.key) ||
        typeof m.title !== "string" ||
        typeof m.group !== "string",
    )
  )
    throw new Error("Invalid module catalogue");
  return modules as import("@/lib/staff-management").ManagementModule[];
}
