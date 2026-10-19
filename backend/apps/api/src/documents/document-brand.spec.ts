import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import { finished } from "node:stream/promises";
import { DocumentPdfService } from "./document-pdf.service";
import { authorizeDocumentOwner } from "./document-scope";
import type { AuthUser } from "../auth/auth.types";
import { bookingDocumentUrl, bookingFieldSection } from "../../../../../src/lib/booking-presentation";
import { PdfController } from "./documents.controller";

test("branded PDF retains privacy headers, safe filename and valid output", async () => {
  const headers: Record<string, unknown> = {};
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", chunk => chunks.push(chunk));
  const response = Object.assign(stream, { setHeader: (name: string, value: unknown) => { headers[name] = value; } });
  const service = new DocumentPdfService({ companySettings: { findFirst: async () => null } } as never);
  await service.pipeA4(response as never, 'test"\r\nrecord', "EXCLUDED", doc => service.writeKV(doc, [["Reference", "SYNTHETIC"]]));
  await finished(stream);
  assert.match(Buffer.concat(chunks).toString("latin1"), /^%PDF/);
  assert.equal(headers["Cache-Control"], "private, no-store");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.doesNotMatch(String(headers["Content-Disposition"]), /[\r\n]/);
});
test("PDF settings failures are returned to the controller before response headers", async () => {
  const service = new DocumentPdfService({ companySettings: { findFirst: async () => { throw new Error("settings unavailable"); } } } as never);
  await assert.rejects(service.pipeA4({ setHeader: () => assert.fail("headers sent") } as never, "test", "INCLUDED", () => {}), /settings unavailable/);
});
test("price exclusion and supplier confidentiality remain enforced", () => {
  const service = new DocumentPdfService({} as never);
  const lines = [{ label: "Total", value: "100" }, { label: "Supplier cost", value: "50" }, { label: "Profit", value: "50" }];
  assert.deepEqual(service.customerLines("EXCLUDED", lines), []);
  assert.deepEqual(service.customerLines("INCLUDED", lines), [lines[0]]);
});
test("visa document ownership requires view permission and the authorized branch", async () => {
  const user = { isSuperAdmin: false, branchIds: ["a"], permissions: ["visa.view"] } as AuthUser;
  const db = (branchId: string) => ({ visaApplication: { findUnique: async () => ({ id: "v", branchId }) } });
  await authorizeDocumentOwner(db("a") as never, user, "visaApplication", "v");
  await assert.rejects(authorizeDocumentOwner(db("b") as never, user, "visaApplication", "v"));
  await assert.rejects(authorizeDocumentOwner(db("a") as never, { ...user, permissions: [] }, "visaApplication", "v"));
});
test("print links are allowlisted and form grouping retains field ownership", () => {
  assert.equal(bookingDocumentUrl("users", "a", true), null);
  assert.equal(bookingDocumentUrl("umrah-bookings", "a/b", false), "/api/v1/pdf/umrah-booking/a%2Fb?mode=EXCLUDED");
  assert.equal(bookingFieldSection("customerId"), "Customer & travellers");
  assert.equal(bookingFieldSection("sellingPrice"), "Pricing & payment");
});
test("new booking summaries authorize owners before fetching printable details", async () => {
  const user = { isSuperAdmin: false, branchIds: ["a"], permissions: ["transport.view", "visa.view"] } as AuthUser;
  let draws = 0;
  const pdf = { parseMode: () => "INCLUDED", pipeA4: () => { draws++; } };
  const db = { transportBooking: { findUnique: async () => ({ id: "t", branchId: "b" }) }, visaApplication: { findUnique: async () => ({ id: "v", branchId: "b" }) } };
  const controller = new PdfController(db as never, pdf as never);
  await assert.rejects(controller.transportBooking("t", "INCLUDED", {} as never, { user } as never));
  await assert.rejects(controller.visaApplication("v", {} as never, { user } as never));
  assert.equal(draws, 0);
});
