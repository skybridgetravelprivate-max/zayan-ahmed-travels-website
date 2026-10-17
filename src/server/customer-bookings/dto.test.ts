import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sanitizeCustomerBooking,
  sanitizeCustomerBookingsResponse,
} from "./dto";

const APPROVED_KEYS = [
  "createdAt",
  "destination",
  "reference",
  "service",
  "status",
  "travelDate",
  "updatedAt",
];

test("sanitizeCustomerBooking allowlists approved fields only", () => {
  const dto = sanitizeCustomerBooking({
    reference: "ZAT-BK-0001",
    service: "Flight",
    destination: "Dubai",
    travelDate: "2026-12-01",
    status: "Upcoming",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    sellingPrice: 99999,
    profit: 1,
    paymentStatus: "Paid",
    notes: "secret",
    client: "crm-id",
    id: "mongo-id",
  });
  assert.ok(dto);
  assert.deepEqual(Object.keys(dto!).sort(), APPROVED_KEYS);
  const json = JSON.stringify(dto);
  assert.equal(json.includes("99999"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("crm-id"), false);
  assert.equal(json.includes("Paid"), false);
});

test("sanitizeCustomerBooking excludes incomplete or inferred rows", () => {
  assert.equal(
    sanitizeCustomerBooking({
      reference: "ZAT-BK-0002",
      service: "Hotel",
      destination: "Makkah",
      travelDate: "2026-12-01",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
      cancelled: false,
      paymentStatus: "Paid",
    }),
    null,
  );
  assert.equal(
    sanitizeCustomerBooking({
      reference: "ZAT-BK-0003",
      service: "Cruise",
      destination: "Dubai",
      travelDate: "2026-12-01",
      status: "Upcoming",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-02T00:00:00.000Z",
    }),
    null,
  );
});

test("sanitizeCustomerBookingsResponse rejects bad envelopes and any invalid booking rows", () => {
  assert.equal(sanitizeCustomerBookingsResponse(null), null);
  assert.equal(sanitizeCustomerBookingsResponse({ items: [] }), null);
  const list = sanitizeCustomerBookingsResponse({
    bookings: [
      {
        reference: "A",
        service: "Umrah",
        destination: "Makkah",
        travelDate: "2026-11-01",
        status: "Completed",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
        profit: 50,
      },
      { reference: "B", service: "Flight" },
    ],
  });
  assert.equal(list, null);
  assert.deepEqual(sanitizeCustomerBookingsResponse({ bookings: [] }), []);
});
