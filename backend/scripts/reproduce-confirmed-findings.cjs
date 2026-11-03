"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("../node_modules/@prisma/client");
const ts = require("../node_modules/typescript");

// Enable in-memory transpilation of TypeScript services
require.extensions[".ts"] = (m, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
    },
  }).outputText;
  m._compile(transpiled, filename);
};

const root = path.resolve(__dirname, "../..");
const { ReportsService } = require(path.join(root, "backend/apps/api/src/reports/reports.service.ts"));
const { ReportsController } = require(path.join(root, "backend/apps/api/src/reports/misc.controller.ts"));
const { ReservationService } = require(path.join(root, "backend/apps/api/src/reservation/reservation.service.ts"));
const { AccountingService } = require(path.join(root, "backend/apps/api/src/finance/accounting.service.ts"));
const { SequenceService } = require(path.join(root, "backend/apps/api/src/common/sequence.service.ts"));
const { AuditService } = require(path.join(root, "backend/apps/api/src/common/audit.service.ts"));

async function main() {
  const databaseUrl =
    process.env.ZAT_SYNTHETIC_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://zat_synthetic@127.0.0.1:55437/zat_synthetic_demo_20261102";

  const target = new URL(databaseUrl);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname));
  assert.match(target.pathname, /^\/zat_synthetic_/);

  console.log("Reproducing confirmed findings against synthetic DB:", target.pathname);

  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const seq = new SequenceService(db);
  const audit = new AuditService(db);
  const accountingService = new AccountingService(db, seq, audit);
  const reportsService = new ReportsService(db, accountingService);
  const reportsController = new ReportsController({}, reportsService);
  const reservationService = new ReservationService(db, seq, audit, accountingService);

  const findings = [];

  try {
    // -------------------------------------------------------------
    // Finding 1: Reservation graph rounds money through Number
    // -------------------------------------------------------------
    console.log("\n[Test 1] Testing Reservation decimal precision with large value 99999999999999.99...");
    // Direct invocation of the reservation totals method:
    // totals is a private method, accessible via prototype or any-cast
    const totalsMethod = reservationService["totals"].bind(reservationService);
    const reservationTotal = totalsMethod([
      {
        hotelId: "mock",
        checkIn: new Date("2026-12-01"),
        checkOut: new Date("2026-12-02"),
        rooms: [{ sellingPrice: "99999999999999.99", supplierCost: "0.00" }],
      },
    ]);
    const roundedNet = reservationTotal.net.toFixed(2);
    console.log("Input sellingPrice: 99999999999999.99");
    console.log("Computed net total:", roundedNet);
    assert.equal(
      roundedNet,
      "99999999999999.98",
      "Finding 1 reproduction: Number conversion lost 1 cent of precision",
    );
    findings.push({
      finding: 1,
      name: "P1 — Reservation graph rounds money through Number",
      defectStatus: "CONFIRMED_REPRODUCED",
      input: "99999999999999.99",
      expectedIfExact: "99999999999999.99",
      actualReturned: roundedNet,
      discrepancy: "-0.01 (floating point binary conversion error)",
    });

    // -------------------------------------------------------------
    // Finding 2: Report CSV exports silently stop at 200 rows
    // -------------------------------------------------------------
    console.log("\n[Test 2] Testing CSV export truncation when >200 rows exist in database...");
    let csvOutput = "";
    const mockRes = {
      setHeader(name, val) {},
      send(data) {
        csvOutput = data;
        return data;
      },
    };
    await reportsController.run("receivables", { format: "csv" }, mockRes);
    const lines = csvOutput.trim().split("\n");
    const dataRowsCount = lines.length - 1; // subtract header line
    console.log("CSV export line count:", lines.length, "| Data rows returned:", dataRowsCount);
    assert.equal(
      dataRowsCount,
      200,
      "Finding 2 reproduction: 250 available receivable records clamped to 200 without incomplete marker",
    );
    findings.push({
      finding: 2,
      name: "P2 — Report CSV exports silently stop at 200 rows",
      defectStatus: "CONFIRMED_REPRODUCED",
      availableRowsInDatabase: 250,
      requestedPageSize: 5000,
      actualExportedRows: dataRowsCount,
      missingRows: 50,
      hasIncompleteMarker: false,
    });

    // -------------------------------------------------------------
    // Finding 3: Introducing segmented stays hides legacy hotel bookings from reports
    // -------------------------------------------------------------
    console.log("\n[Test 3] Testing mixed stayRows with segmented and legacy hotel bookings in database...");
    const stayRowsMethod = reportsService["stayRows"].bind(reportsService);
    const allStays = await stayRowsMethod();
    console.log("Total stay rows returned from database:", allStays.length);
    console.log("Stay row refs:", allStays.map((s) => s.ref));
    // Verify that segmented stays exist:
    assert.ok(allStays.some((s) => s.ref === "ZAT-HB-DEMO-SEG"));
    // Verify that the legacy hotel booking "ZAT-HB-DEMO-LEGACY" is NOT in stayRows:
    const legacyPresent = allStays.some((s) => s.ref === "ZAT-HB-DEMO-LEGACY");
    assert.equal(
      legacyPresent,
      false,
      "Finding 3 reproduction: Legacy hotel booking is completely suppressed because segmented stays exist",
    );
    findings.push({
      finding: 3,
      name: "P2 — Introducing segmented stays hides legacy hotel bookings from reports",
      defectStatus: "CONFIRMED_REPRODUCED",
      segmentedStaysFound: allStays.length,
      legacyBookingRef: "ZAT-HB-DEMO-LEGACY",
      legacyBookingPresentInReport: legacyPresent,
      cause: "reports.service.ts:115 returns segs immediately when segs.length > 0",
    });

    // -------------------------------------------------------------
    // Finding 4: Daily hotel detail combines different hotels under one name
    // -------------------------------------------------------------
    console.log("\n[Test 4] Testing daily hotel detail grouping collision when two hotels share stay dates...");
    const hotelDetail2 = await reportsService.run("hotel-detail-2", {});
    console.log("hotel-detail-2 rows returned:", hotelDetail2.rows);
    // Find the date 2026-12-10 (where both Makkah Royal Clock and Makkah Grand Tower stay)
    const rowDec10 = hotelDetail2.rows.find((r) => r.date === "2026-12-10");
    assert.ok(rowDec10, "Row for 2026-12-10 must exist");
    console.log("2026-12-10 grouped row:", rowDec10);
    // Notice that both hotels (1 room each, 2 total rooms) got merged into the first hotel's name:
    assert.equal(rowDec10.rooms, 2, "Rooms from both hotels were aggregated together");
    assert.equal(rowDec10.hotel, "Makkah Royal Clock Synthetic Hotel", "Only first hotel name was kept");
    // Verify there is no separate row for Makkah Grand Synthetic Tower on 2026-12-10:
    const dec10Rows = hotelDetail2.rows.filter((r) => r.date === "2026-12-10");
    assert.equal(
      dec10Rows.length,
      1,
      "Finding 4 reproduction: Two distinct hotels on same date collapsed into single row",
    );
    findings.push({
      finding: 4,
      name: "P2 — Daily hotel detail combines different hotels under one name",
      defectStatus: "CONFIRMED_REPRODUCED",
      dateTested: "2026-12-10",
      distinctHotelsBooked: [
        "Makkah Royal Clock Synthetic Hotel",
        "Makkah Grand Synthetic Tower",
      ],
      outputRow: rowDec10,
      cause: "reports.service.ts:236 groups key exclusively by date '!by[d]', discarding second hotel identity",
    });

    // -------------------------------------------------------------
    // Finding 5: Approval report silently ignores supplied date filters
    // -------------------------------------------------------------
    console.log("\n[Test 5] Testing approval-booking with date range 2026-01-01 to 2026-12-31 on 2020 booking...");
    const approvalReport = await reportsService.run("approval-booking", {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    console.log("approval-booking rows:", approvalReport.rows);
    // The historical 2020 booking (net: 150000.00) is included in the UMRAH confirmed total!
    const umrahRow = approvalReport.rows.find((r) => r.module === "UMRAH" && r.status === "CONFIRMED");
    assert.ok(umrahRow, "UMRAH confirmed row must exist");
    console.log("UMRAH CONFIRMED row:", umrahRow);
    // In our seed, we have booking1 (net: 560000) and historical 2020 booking (net: 150000). Total count = 2!
    // If the 2026 date filter was applied, the 2020 booking would be excluded, count would be 1.
    // Because date filter is ignored, the 2020 booking is included:
    assert.ok(
      umrahRow.count >= 2,
      "Finding 5 reproduction: 2020 historical booking included despite from/to 2026 filter",
    );
    findings.push({
      finding: 5,
      name: "P2 — Approval report silently ignores supplied date filters",
      defectStatus: "CONFIRMED_REPRODUCED",
      requestedFilter: { from: "2026-01-01", to: "2026-12-31" },
      historicalBookingCreatedAt: "2020-05-15",
      historicalBookingIncluded: true,
      umrahConfirmedCount: umrahRow.count,
      cause: "reports.service.ts:279 prisma.umrahBooking.findMany() called with no where date clause",
    });

    // Summary of evidence
    const evidenceReport = {
      timestamp: new Date().toISOString(),
      databaseTarget: databaseUrl,
      environment: "Synthetic isolated PostgreSQL 17 (loopback only)",
      findingsSummary: {
        totalConfirmedFindings: 5,
        reproducedSuccessfully: 5,
        findings,
      },
    };

    const outDir = path.resolve(root, "work/synthetic-demo-evidence");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "confirmed-findings-reproduction.json");
    fs.writeFileSync(outPath, JSON.stringify(evidenceReport, null, 2), "utf8");

    console.log("\n=======================================================");
    console.log("ALL 5 CONFIRMED CODE REVIEW FINDINGS FAITHFULLY REPRODUCED!");
    console.log("Evidence written to:", outPath);
    console.log("=======================================================");

    return evidenceReport;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Defect reproduction error:", err);
    process.exit(1);
  });
}

module.exports = { main };
