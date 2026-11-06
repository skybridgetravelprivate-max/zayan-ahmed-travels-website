import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPreferences,
  prepareTravelInquiry,
  telephoneLink,
  travelServices,
  whatsappLink,
  publicTravelReference,
} from "./travel-inquiry";
import { validateInquiry } from "./inquiries";

const today = "2026-11-05";
const flight = {
  ...initialPreferences("Flights"),
  from: "Islamabad (ISB)",
  destination: "Jeddah (JED)",
  departure: "2027-01-15",
};

test("all four prepared service payloads satisfy the existing server contract", () => {
  for (const service of travelServices) {
    const result = prepareTravelInquiry(
      service,
      {
        ...flight,
        destination: service === "Visa" ? "UAE" : flight.destination,
      },
      today,
    );
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.message);
    const inquiry = result.inquiry;
    assert.equal(
      validateInquiry({
        ...inquiry,
        name: "Synthetic Traveller",
        email: "traveller@example.test",
        phone: "03000000000",
        message: inquiry.summary,
      }).ok,
      true,
    );
    assert.match(inquiry.summary, /2027-01-15/);
  }
});

test("date corrections through either field recover without stale validity", () => {
  const bad = { ...flight, trip: "Return", returning: "2027-01-14" };
  assert.equal(prepareTravelInquiry("Flights", bad, today).ok, false);
  assert.equal(
    prepareTravelInquiry("Flights", { ...bad, departure: "2027-01-13" }, today)
      .ok,
    true,
  );
  assert.equal(
    prepareTravelInquiry("Flights", { ...bad, returning: "2027-01-16" }, today)
      .ok,
    true,
  );
  assert.equal(
    prepareTravelInquiry("Flights", { ...bad, trip: "One way" }, today).ok,
    true,
  );
});

test("invalid calendar dates, past departures, same routes and traveller bounds fail", () => {
  for (const patch of [
    { departure: "2027-02-30" },
    { departure: "2026-11-04" },
    { destination: "islamabad (isb)" },
    { travellers: "0" },
    { travellers: "100" },
    { travellers: "1.5" },
    { destination: "" },
  ]) {
    assert.equal(
      prepareTravelInquiry("Flights", { ...flight, ...patch }, today).ok,
      false,
    );
  }
  assert.equal(
    prepareTravelInquiry("Umrah", { ...flight, nights: "6" }, today).ok,
    false,
  );
  assert.equal(
    prepareTravelInquiry("Umrah", { ...flight, nights: "60" }, today).ok,
    true,
  );
});

test("irrelevant service fields cannot leak stale return or cabin preferences into visa summary", () => {
  const result = prepareTravelInquiry(
    "Visa",
    { ...flight, trip: "Return", returning: "2020-01-01", cabin: "Business" },
    today,
  );
  assert.equal(result.ok, true);
  if (result.ok)
    assert.doesNotMatch(result.inquiry.summary, /2020|Business|Return/);
});

test("WhatsApp context is encoded and telephone links normalize plus signs", () => {
  const url = new URL(
    whatsappLink("+92 312 1558860", "Umrah & Tours · ISB → JED"),
  );
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.searchParams.get("text"), "Umrah & Tours · ISB → JED");
  assert.equal(telephoneLink("++92 312 1558860"), "tel:+923121558860");
  assert.equal(whatsappLink("invalid"), "");
  assert.equal(telephoneLink("invalid"), "");
});

test("only public content references enter package quotation context", () => {
  assert.equal(
    publicTravelReference("/pages/synthetic-tour"),
    "/pages/synthetic-tour",
  );
  assert.equal(
    publicTravelReference("/umrah/synthetic_package"),
    "/umrah/synthetic_package",
  );
  for (const value of [
    "//outside.example",
    "/admin/customers",
    "/pages/../admin",
    "/pages/item?email=private@example.test",
    ["/pages/item"],
  ])
    assert.equal(publicTravelReference(value), "");
});
