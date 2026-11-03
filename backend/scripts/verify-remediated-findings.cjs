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

  console.log("Verifying remediated findings against synthetic DB:", target.pathname);

  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const seq = new SequenceService(db);
  const audit = new AuditService(db);
  const accountingService = new AccountingService(db, seq, audit);
  const reportsService = new ReportsService(db, accountingService);
  const reportsController = new ReportsController({}, reportsService);
  const reservationService = new ReservationService(db, seq, audit, accountingService);

  const verifications = [];

  try {
    // -------------------------------------------------------------
    // Verification 1: Reservation graph exact decimal precision
    // -------------------------------------------------------------
    console.log("\n[Verify 1] Verifying Reservation decimal precision with large value 99999999999999.99...");
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
      "99999999999999.99",
      "Finding 1 verification: Decimal arithmetic preserved full precision",
    );
    verifications.push({
      finding: 1,
      name: "P1 — Reservation graph rounds money through Number",
      status: "VERIFIED_REPAIRED",
      input: "99999999999999.99",
      result: roundedNet,
    });

    // -------------------------------------------------------------
    // Verification 2: Report CSV exports >200 rows complete
    // -------------------------------------------------------------
    console.log("\n[Verify 2] Verifying CSV export retrieves all 250 rows without 200-row clamping...");
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
    const dataRowsCount = lines.length - 1;
    console.log("CSV export line count:", lines.length, "| Data rows returned:", dataRowsCount);
    assert.ok(
      dataRowsCount >= 250,
      "Finding 2 verification: All available records (>200) exported completely without 200-row clamping",
    );
    verifications.push({
      finding: 2,
      name: "P2 — Report CSV exports silently stop at 200 rows",
      status: "VERIFIED_REPAIRED",
      availableRows: 250,
      exportedRows: dataRowsCount,
    });

    // -------------------------------------------------------------
    // Verification 3: Segmented and legacy hotel bookings both in stayRows
    // -------------------------------------------------------------
    console.log("\n[Verify 3] Verifying mixed stayRows includes both segmented and legacy hotel bookings...");
    const stayRowsMethod = reportsService["stayRows"].bind(reportsService);
    const allStays = await stayRowsMethod();
    console.log("Total stay rows returned from database:", allStays.length);
    console.log("Stay row refs:", allStays.map((s) => s.ref));
    const segPresent = allStays.some((s) => s.ref === "ZAT-HB-DEMO-SEG");
    const legacyPresent = allStays.some((s) => s.ref === "ZAT-HB-DEMO-LEGACY");
    assert.ok(segPresent, "Segmented stay must be present");
    assert.ok(legacyPresent, "Finding 3 verification: Legacy booking is retained alongside segmented stays");
    verifications.push({
      finding: 3,
      name: "P2 — Introducing segmented stays hides legacy hotel bookings from reports",
      status: "VERIFIED_REPAIRED",
      segmentedStaysFound: allStays.filter((s) => s.ref === "ZAT-HB-DEMO-SEG").length,
      legacyStaysFound: allStays.filter((s) => s.ref === "ZAT-HB-DEMO-LEGACY").length,
    });

    // -------------------------------------------------------------
    // Verification 4: Daily hotel detail retains distinct hotel rows
    // -------------------------------------------------------------
    console.log("\n[Verify 4] Verifying daily hotel detail distinguishes distinct hotels sharing the same date...");
    const hotelDetail2 = await reportsService.run("hotel-detail-2", {});
    console.log("hotel-detail-2 rows returned:", hotelDetail2.rows);
    const dec10Rows = hotelDetail2.rows.filter((r) => r.date === "2026-12-10");
    console.log("2026-12-10 rows count:", dec10Rows.length, dec10Rows);
    assert.equal(
      dec10Rows.length,
      2,
      "Finding 4 verification: Both distinct hotels on 2026-12-10 have individual rows",
    );
    const hotelNames = dec10Rows.map((r) => r.hotel);
    assert.ok(hotelNames.includes("Makkah Royal Clock Synthetic Hotel"));
    assert.ok(hotelNames.includes("Makkah Grand Synthetic Tower"));
    verifications.push({
      finding: 4,
      name: "P2 — Daily hotel detail combines different hotels under one name",
      status: "VERIFIED_REPAIRED",
      dateTested: "2026-12-10",
      distinctHotelRows: dec10Rows.length,
      hotels: hotelNames,
    });

    // -------------------------------------------------------------
    // Verification 5: Approval report date filtering enforced
    // -------------------------------------------------------------
    console.log("\n[Verify 5] Verifying approval-booking honors date range 2026-01-01 to 2026-12-31...");
    const unfilteredReport = await reportsService.run("approval-booking", {});
    const unfilteredUmrah = unfilteredReport.rows.find((r) => r.module === "UMRAH" && r.status === "CONFIRMED");
    console.log("Unfiltered UMRAH CONFIRMED row:", unfilteredUmrah);
    assert.equal(unfilteredUmrah.count, 4, "Unfiltered report includes all 4 bookings (including 2020)");

    const approvalReport2026 = await reportsService.run("approval-booking", {
      from: "2026-01-01",
      to: "2026-12-31",
    });
    console.log("2026 filtered approval-booking rows:", approvalReport2026.rows);
    const umrah2026Row = approvalReport2026.rows.find((r) => r.module === "UMRAH" && r.status === "CONFIRMED");
    assert.ok(umrah2026Row, "UMRAH confirmed row must exist");
    console.log("2026 UMRAH CONFIRMED row:", umrah2026Row);
    assert.equal(
      umrah2026Row.count,
      3,
      "Finding 5 verification: 2020 historical booking is excluded by the 2026 date filter",
    );
    assert.equal(umrah2026Row.sale, 680100.03, "Sale total excludes 150,000.00 from 2020 booking");

    const approvalReport2020 = await reportsService.run("approval-booking", {
      from: "2020-01-01",
      to: "2020-12-31",
    });
    const umrah2020Row = approvalReport2020.rows.find((r) => r.module === "UMRAH" && r.status === "CONFIRMED");
    console.log("2020 UMRAH CONFIRMED row:", umrah2020Row);
    assert.equal(umrah2020Row.count, 1, "2020 filter returns only the historical 2020 booking");
    assert.equal(umrah2020Row.sale, 150000, "2020 filter sale is exactly 150,000.00");

    verifications.push({
      finding: 5,
      name: "P2 — Approval report silently ignores supplied date filters",
      status: "VERIFIED_REPAIRED",
      unfilteredCount: unfilteredUmrah.count,
      filter2026Count: umrah2026Row.count,
      filter2020Count: umrah2020Row.count,
      historicalBookingExcludedFrom2026: true,
    });

    const report = {
      timestamp: new Date().toISOString(),
      databaseTarget: databaseUrl,
      environment: "Synthetic isolated PostgreSQL 17 (loopback only)",
      verificationSummary: {
        totalFindings: 5,
        repairedSuccessfully: 5,
        verifications,
      },
    };

    const outDir = path.resolve(root, "work/synthetic-demo-evidence");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "confirmed-findings-remediated.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    console.log("\n=======================================================");
    console.log("ALL 5 CONFIRMED CODE REVIEW FINDINGS VERIFIED AS FULLY REPAIRED!");
    console.log("Evidence written to:", outPath);
    console.log("=======================================================");

    return report;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Verification error:", err);
    process.exit(1);
  });
}

module.exports = { main };
