export type AuthUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  permissions: string[];
  roleNames: string[];
  branchIds: string[];
  defaultBranchId: string | null;
  isSuperAdmin: boolean;
};

export function can(user: AuthUser, permission: string) {
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(permission);
}

export function assertCan(user: AuthUser, permission: string) {
  if (!can(user, permission)) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
