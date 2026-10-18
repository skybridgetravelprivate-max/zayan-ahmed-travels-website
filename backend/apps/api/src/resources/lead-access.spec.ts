import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthUser } from "../auth/auth.types";
import { ResourcesService } from "./resources.service";

const scopedUser: AuthUser = {
  id: "staff-a",
  email: "staff@example.test",
  username: "staff-a",
  fullName: "Staff A",
  permissions: ["lead.view"],
  roleNames: ["Sales"],
  branchIds: ["branch-a"],
  defaultBranchId: null,
  isSuperAdmin: false,
};

test("lead listing requires lead.view and constrains paginated searches to authorized branches", async () => {
  let listArgs: Record<string, unknown> | undefined;
  let countArgs: Record<string, unknown> | undefined;
  const service = new ResourcesService(
    {
      lead: {
        findMany: async (args: Record<string, unknown>) => {
          listArgs = args;
          return [{ id: "lead-a", branchId: "branch-a" }];
        },
        count: async (args: Record<string, unknown>) => {
          countArgs = args;
          return 1;
        },
      },
    } as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.list("leads", { ...scopedUser, permissions: [] }, { page: "1" }),
    { status: 403 },
  );
  assert.equal(listArgs, undefined);

  const result = await service.list("leads", scopedUser, {
    page: "2",
    pageSize: "10",
    q: "traveller",
  });
  assert.deepEqual(result, {
    data: [{ id: "lead-a", branchId: "branch-a" }],
    total: 1,
    page: 2,
    pageSize: 10,
  });
  assert.deepEqual(listArgs?.where, {
    branchId: { in: ["branch-a"] },
    OR: [
      { fullName: { contains: "traveller", mode: "insensitive" } },
      { mobile: { contains: "traveller", mode: "insensitive" } },
      { email: { contains: "traveller", mode: "insensitive" } },
      { cnic: { contains: "traveller", mode: "insensitive" } },
      { leadNumber: { contains: "traveller", mode: "insensitive" } },
    ],
  });
  assert.equal(listArgs?.skip, 10);
  assert.equal(listArgs?.take, 10);
  assert.deepEqual(countArgs?.where, listArgs?.where);
});

test("lead detail hides foreign and unassigned-branch records from scoped staff", async () => {
  let queried = "";
  const service = new ResourcesService(
    {
      lead: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          queried = where.id;
          return {
            id: where.id,
            branchId: where.id === "foreign" ? "branch-b" : null,
            cnic: "private",
          };
        },
      },
    } as never,
    {} as never,
    {} as never,
  );

  for (const id of ["foreign", "unassigned"]) {
    await assert.rejects(service.get("leads", id, scopedUser), { status: 404 });
    assert.equal(queried, id);
  }
  await assert.rejects(
    service.get("leads", "foreign", { ...scopedUser, permissions: [] }),
    { status: 403 },
  );
});

test("scoped staff cannot override lead list branch filters", async () => {
  let reads = 0;
  const service = new ResourcesService(
    {
      lead: {
        findMany: async () => {
          reads += 1;
          return [];
        },
        count: async () => 0,
      },
    } as never,
    {} as never,
    {} as never,
  );

  await assert.rejects(
    service.list("leads", scopedUser, { branchId: "branch-b" }),
    { status: 403 },
  );
  assert.equal(reads, 0);
});
