export type LoginPortal = "super-admin" | "admin" | "staff";

// Role membership selects an entry point; permissions and branch scope remain
// owned by the existing request guards. A portal never grants a role.
export function loginPortalForRoles(names: string[]): LoginPortal {
  if (names.some(name => name === "SUPER_ADMIN" || name === "Super Admin")) return "super-admin";
  if (names.some(name => name === "ADMIN" || name === "Admin")) return "admin";
  return "staff";
}

export function isLoginPortal(value: unknown): value is LoginPortal {
  return value === "super-admin" || value === "admin" || value === "staff";
}
