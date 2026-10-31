import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword } from "../common/password";
import { AuthController } from "./auth.controller";
import { loginPortalForRoles } from "./login-portal";

test("highest assigned role selects portal without inferring rights from permissions", () => {
  assert.equal(loginPortalForRoles(["STAFF", "Admin", "SUPER_ADMIN"]), "super-admin");
  assert.equal(loginPortalForRoles(["Super Admin"]), "super-admin");
  assert.equal(loginPortalForRoles(["MANAGER", "ADMIN"]), "admin");
  for (const roles of [[], ["STAFF"], ["Accounts"], ["Manager"], ["Website Editor"]]) assert.equal(loginPortalForRoles(roles), "staff");
});

test("portal mismatch denies session and cookies; matched and legacy clients retain guarded sessions", async () => {
  const passwordHash = await hashPassword("Synthetic-only-password-2026");
  for (const role of ["SUPER_ADMIN", "Admin", "STAFF"]) {
    for (const portal of ["super-admin", "admin", "staff", undefined]) {
      let sessions = 0; let cookies = 0; let updates = 0; let success: unknown;
      const user = { id: "synthetic", email: "synthetic@example.invalid", fullName: "Synthetic", passwordHash, status: "ACTIVE", failedLogins: 0 };
      const prisma = {
        user: { findFirst: async () => user, update: async () => { updates++; } },
        userRole: { findMany: async () => [{ role: { name: role } }] },
        loginAttempt: { create: async (arg: { data: { success: boolean } }) => { success = arg.data.success; } },
        session: { create: async () => { sessions++; return { id: "synthetic-session" }; } },
      };
      const controller = new AuthController(prisma as never, { signAsync: async () => "synthetic-token" } as never, {} as never);
      const attempt = () => controller.login({ identifier: user.email, password: "Synthetic-only-password-2026", portal }, { headers: {} } as never, { cookie: () => { cookies++; } } as never);
      if (portal === undefined || portal === loginPortalForRoles([role])) {
        assert.equal((await attempt()).ok, true);
        assert.equal(sessions, 1); assert.equal(cookies, 2); assert.equal(success, true);
      } else {
        await assert.rejects(attempt(), { status: 401 });
        assert.equal(sessions, 0); assert.equal(cookies, 0); assert.equal(updates, 0); assert.equal(success, false);
      }
    }
  }
});

test("unrecognized portal is rejected before any account lookup", async () => {
  const controller = new AuthController({} as never, {} as never, {} as never);
  await assert.rejects(controller.login({ identifier: "synthetic", password: "synthetic", portal: "owner" }, {} as never, {} as never), { status: 400 });
});
