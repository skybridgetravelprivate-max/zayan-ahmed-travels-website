import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAccountBooking,
  parseAccountBookingsResponse,
} from "./account-bookings";

test("parseAccountBooking drops financial and internal fields", () => {
  const row = parseAccountBooking({
    reference: "ZAT-BK-1",
    service: "Flight",
    destination: "Dubai",
    travelDate: "2026-12-01",
    status: "Upcoming",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    sellingPrice: 900,
    profit: 40,
    paymentStatus: "Paid",
    notes: "secret",
    client: "crm-id",
  });
  assert.ok(row);
  assert.deepEqual(Object.keys(row!).sort(), [
    "createdAt",
    "destination",
    "reference",
    "service",
    "status",
    "travelDate",
    "updatedAt",
  ]);
  const json = JSON.stringify(row);
  assert.equal(json.includes("900"), false);
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("Paid"), false);
});

test("parseAccountBookingsResponse maps 401 / 503 and success", () => {
  assert.deepEqual(parseAccountBookingsResponse(401, { ok: false }), {
    ok: false,
    kind: "unauthorized",
  });
  assert.deepEqual(parseAccountBookingsResponse(503, { ok: false, error: "Bookings are temporarily unavailable." }), {
    ok: false,
    kind: "unavailable",
  });
  const ok = parseAccountBookingsResponse(200, {
    ok: true,
    bookings: [
      {
        reference: "A",
        service: "Hotel",
        destination: "Makkah",
        travelDate: "2026-11-01",
        status: "Completed",
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-02T00:00:00.000Z",
      },
    ],
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.bookings.length, 1);
  assert.equal(ok.bookings[0].reference, "A");
});

test("parseAccountBookingsResponse rejects demo markers and invalid rows", () => {
  const result = parseAccountBookingsResponse(200, {
    ok: true,
    bookings: [
      {
        id: "jeddah-flight",
        reference: "ZY-DEMO-10421",
        service: "Flight",
        destination: "Islamabad to Jeddah",
        travelDate: "12 Nov 2026",
        status: "Upcoming",
      },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Incomplete DTO (missing createdAt/updatedAt) must not appear as a real booking.
  assert.equal(result.bookings.length, 0);
});
