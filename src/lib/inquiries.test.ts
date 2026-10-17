import assert from "node:assert/strict";
import { test } from "node:test";
import { validateInquiry } from "./inquiries";

test("inquiries reject impossible calendar dates while accepting leap day", () => {
  const input = { type: "contact", name: "Example Traveller", email: "traveller@example.test", phone: "+923001234567", message: "Please contact me about travel options." };
  for (const travelDate of ["2026-02-30", "2026-02-29", "2026-04-31"]) {
    const result = validateInquiry({ ...input, travelDate });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.fields?.travelDate);
  }
  assert.equal(validateInquiry({ ...input, travelDate: "2028-02-29" }).ok, true);
});
