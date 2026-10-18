import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStaffLeadDetail, parseStaffLeadPage } from "./staff-leads";

const lead = {
  id: "lead-123",
  leadNumber: "ZAT-LD-123",
  fullName: "A Traveller",
  mobile: "+1 555 0100",
  email: "traveller@example.test",
  city: "Abbottabad",
  status: "NEW",
  source: "WEBSITE",
  priority: "MEDIUM",
  createdAt: "2026-10-01T12:00:00.000Z",
  cnic: "sensitive-cnic",
  passport: "sensitive-passport",
  budget: "88888.00",
  notes: "private internal notes",
  customers: [{ id: "customer-private" }],
  followUps: [{ subject: "private follow-up" }],
  assignedUser: { fullName: "Assigned staff", passwordHash: "private-hash" },
  assignedAgent: { name: "Travel agent", accountNumber: "private-account" },
};

test("lead list mapper only exposes summary fields allowed in the staff UI", () => {
  const parsed = parseStaffLeadPage({
    data: [lead],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  assert.ok(parsed);
  assert.deepEqual(parsed.data[0], {
    id: "lead-123",
    leadNumber: "ZAT-LD-123",
    fullName: "A Traveller",
    mobile: "+1 555 0100",
    email: "traveller@example.test",
    city: "Abbottabad",
    status: "NEW",
    source: "WEBSITE",
    priority: "MEDIUM",
    createdAt: "2026-10-01T12:00:00.000Z",
  });
  assert.doesNotMatch(JSON.stringify(parsed), /sensitive|private/);
});

test("lead detail mapper excludes identity documents, budgets, notes and linked records", () => {
  const parsed = parseStaffLeadDetail({
    ...lead,
    whatsapp: "+1 555 0101",
    country: "Pakistan",
    travelDate: "2026-11-01T00:00:00.000Z",
    returnDate: null,
    adults: 2,
    children: 1,
    infants: 0,
  });
  assert.ok(parsed);
  assert.equal(parsed.assignedUser, "Assigned staff");
  assert.equal(parsed.assignedAgent, "Travel agent");
  assert.deepEqual(parsed.adults, 2);
  assert.doesNotMatch(JSON.stringify(parsed), /sensitive|private|88888/);
});

test("malformed lead responses fail closed", () => {
  assert.equal(parseStaffLeadPage({ data: "not an array", total: 1, page: 1, pageSize: 20 }), null);
  assert.equal(parseStaffLeadPage({ data: [lead], total: -1, page: 1, pageSize: 20 }), null);
  assert.equal(parseStaffLeadPage({ data: [{ ...lead, id: "" }], total: 1, page: 1, pageSize: 20 }), null);
  assert.equal(parseStaffLeadDetail({ ...lead, status: null }), null);
});
