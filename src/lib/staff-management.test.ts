import { canonicalMoney } from "./staff-management";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formPayload,
  displayValue,
  rowLabel,
  staffConflictMessage,
  formatRecordValue,
} from "./staff-management";
import { workflowsFor, STAFF_WORKFLOWS } from "./staff-workflows";

test("accounting-review conflict has a fixed safe message; arbitrary server details are withheld", () => {
  assert.match(
    staffConflictMessage({
      code: "UMRAH_CANCELLATION_REVIEW_REQUIRED",
      message: "private fixture",
    }),
    /Cancellation requires accounting review/,
  );
  for (const body of [
    null,
    [],
    "private fixture",
    { message: "private fixture" },
    { code: "UNKNOWN", message: "private fixture" },
  ]) {
    assert.equal(
      staffConflictMessage(body),
      "The record changed or conflicts with an existing record. Reload and review before saving.",
    );
  }
});

test("form serialization sends only declared fields and preserves explicit clearing", () => {
  const form = new FormData();
  form.set("name", "Synthetic");
  form.set("email", "");
  form.set("admin", "true");
  const fields = [
    {
      name: "name",
      label: "Name",
      type: "String",
      nullable: false,
      required: true,
    },
    {
      name: "email",
      label: "Email",
      type: "String",
      nullable: true,
      required: false,
    },
  ];
  assert.deepEqual(formPayload(fields, form, false), {
    name: "Synthetic",
    email: null,
  });
  assert.deepEqual(formPayload(fields, form, true), { name: "Synthetic" });
});
test("display excludes nested secrets and workflow availability follows permissions", () => {
  assert.equal(displayValue({ passwordHash: "secret" }), "—");
  assert.equal(
    rowLabel({ id: "one", version: null, fullName: "Synthetic" }),
    "Synthetic",
  );
  assert.equal(
    rowLabel({ id: "request_internal", version: null, receiptNo: "ZAT-REC-1" }),
    "ZAT-REC-1",
  );
  assert.equal(workflowsFor("tickets", true, ["ticket.view"], false).length, 0);
  assert.equal(
    workflowsFor("tickets", true, ["ticket.refund"], false)[0].key,
    "refund",
  );
  assert.equal(
    workflowsFor("payments", false, ["account.post"], false).length,
    0,
  );
  assert.equal(workflowsFor("payments", false, [], true).length, 1);
  for (const actions of Object.values(STAFF_WORKFLOWS))
    for (const a of actions)
      assert.match(a.path, /^\/api\/v1\/[a-z/-]+(?::id)?[a-z/-]*$/);
});

test("business presentation preserves exact decimals, company dates and restricted labels", () => {
  const field = {
    name: "amount",
    label: "Amount",
    type: "Decimal",
    required: false,
    nullable: true,
  };
  assert.equal(
    formatRecordValue(field, {
      id: "x",
      version: null,
      amount: "9999999999999999.99",
    }),
    "9,999,999,999,999,999.99",
  );
  assert.equal(
    formatRecordValue(field, { id: "x", version: null, amount: "-0.25" }),
    "-0.25",
  );
  assert.equal(
    formatRecordValue(
      { ...field, name: "customerId", reference: "customers" },
      {
        id: "x",
        version: null,
        customerId: "private-foreign-id",
        presentation: {
          timeZone: "Asia/Karachi",
          references: {
            customerId: {
              label: "Restricted or unavailable record",
              link: false,
            },
          },
        },
      },
    ),
    "Restricted or unavailable record",
  );
  assert.match(
    formatRecordValue(
      { ...field, name: "at", type: "DateTime" },
      { id: "x", version: null, at: "2026-10-29T20:00:00Z" },
    ),
    /30\WOct\W2026/,
  );
});

test("financial entry preserves large cents and rejects unsupported precision", () => {
  assert.equal(canonicalMoney("99999999999999.99"), "99999999999999.99");
  assert.equal(canonicalMoney("000125.2"), "125.20");
  for (const input of ["1.001", "-0.01", "1e3", "10000000000000000.00"]) assert.throws(() => canonicalMoney(input));
});
