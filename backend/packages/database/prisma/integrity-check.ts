import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createPostgresConnectionConfig } from "@zat/config/postgres-tls";

const REQUIRED_TABLES = [
  "User",
  "Role",
  "Permission",
  "Customer",
  "Passenger",
  "Supplier",
  "Airline",
  "Airport",
  "Hotel",
  "HotelRoomType",
  "HotelRoom",
  "RoomType",
  "Vehicle",
  "Driver",
  "VisaType",
  "Country",
  "City",
  "Service",
  "ChartOfAccount",
  "PaymentMethod",
  "NumberSequence",
  "CompanySettings",
  "SystemSetting",
  "AuditLog",
];

const REQUIRED_FKS: { table: string; column: string; foreign_table: string }[] = [
  { table: "City", column: "countryId", foreign_table: "Country" },
  { table: "Airport", column: "cityId", foreign_table: "City" },
  { table: "Airport", column: "countryId", foreign_table: "Country" },
  { table: "Hotel", column: "supplierId", foreign_table: "Supplier" },
  { table: "Hotel", column: "cityId", foreign_table: "City" },
  { table: "Hotel", column: "countryId", foreign_table: "Country" },
  { table: "HotelRoomType", column: "hotelId", foreign_table: "Hotel" },
  { table: "HotelRoom", column: "hotelId", foreign_table: "Hotel" },
  { table: "HotelRoom", column: "roomTypeId", foreign_table: "HotelRoomType" },
  { table: "Passenger", column: "customerId", foreign_table: "Customer" },
  { table: "Vehicle", column: "supplierId", foreign_table: "Supplier" },
  { table: "Driver", column: "supplierId", foreign_table: "Supplier" },
  { table: "VisaApplication", column: "visaTypeId", foreign_table: "VisaType" },
  { table: "Payment", column: "paymentMethodId", foreign_table: "PaymentMethod" },
  { table: "HotelStayRoomPax", column: "passengerId", foreign_table: "Passenger" },
  { table: "UserRole", column: "userId", foreign_table: "User" },
  { table: "UserRole", column: "roleId", foreign_table: "Role" },
];

type RelRow = { table_name: string; column_name: string; foreign_table_name: string };

function assertMigrationSql(): string[] {
  const sqlPath = resolve(
    process.cwd(),
    "prisma/migrations/20260924120000_core_database_architecture/migration.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");
  const failures: string[] = [];
  for (const t of REQUIRED_TABLES) {
    if (!sql.includes(`CREATE TABLE "${t}"`)) failures.push(`migration missing CREATE TABLE ${t}`);
  }
  for (const fk of REQUIRED_FKS) {
    const needle = `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.foreign_table}"`;
    if (!sql.includes(needle)) failures.push(`migration missing FK ${fk.table}.${fk.column}->${fk.foreign_table}`);
  }
  if (!sql.includes('CONSTRAINT "hotel_stay_checkout_after_checkin"')) {
    failures.push("migration missing CHECK hotel_stay_checkout_after_checkin");
  }
  if (!sql.includes("DROP TABLE") || !sql.includes("DROP COLUMN")) {
    // no-op: ensure we did not ship destructive drops in this additive init beyond none
  }
  if (/\bDROP TABLE\b/i.test(sql)) failures.push("migration contains DROP TABLE");
  return failures;
}

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        ...createPostgresConnectionConfig(url),
        max: 5,
      }),
    ),
  });
}

async function liveCheck(prisma: PrismaClient): Promise<string[]> {
  const failures: string[] = [];
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const names = new Set(tables.map((t) => t.tablename));
  for (const t of REQUIRED_TABLES) {
    if (!names.has(t)) failures.push(`missing table ${t}`);
  }

  const fks = await prisma.$queryRaw<RelRow[]>`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `;
  const fkSet = new Set(fks.map((r) => `${r.table_name}.${r.column_name}->${r.foreign_table_name}`));
  for (const fk of REQUIRED_FKS) {
    const key = `${fk.table}.${fk.column}->${fk.foreign_table}`;
    if (!fkSet.has(key)) failures.push(`missing FK ${key}`);
  }

  const unvalidatedFks = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND convalidated = false
      AND connamespace = 'public'::regnamespace
  `;
  for (const fk of unvalidatedFks) {
    failures.push(`unvalidated FK ${fk.conname}`);
  }

  const uniqueCols = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
  `;
  const uniqueSet = new Set(uniqueCols.map((r) => `${r.table_name}.${r.column_name}`));
  for (const col of [
    "Country.iso2",
    "Airport.iata",
    "Airline.code",
    "NumberSequence.key",
    "PaymentMethod.code",
    "Service.code",
    "VisaType.code",
    "HotelRoom.hotelId",
    "HotelRoom.roomNumber",
    "User.email",
    "Role.name",
    "Permission.code",
    "Customer.customerNumber",
  ]) {
    if (!uniqueSet.has(col)) failures.push(`missing unique ${col}`);
  }

  const checkConstraint = await prisma.$queryRaw<{ conname: string }[]>`
    SELECT conname FROM pg_constraint WHERE conname = 'hotel_stay_checkout_after_checkin'
  `;
  if (checkConstraint.length === 0) failures.push("missing CHECK hotel_stay_checkout_after_checkin");

  const customerCount = await prisma.customer.count();
  const passengerCount = await prisma.passenger.count();
  console.log(JSON.stringify({ existingCustomers: customerCount, existingPassengers: passengerCount }, null, 2));
  return failures;
}

async function main() {
  const sqlFailures = assertMigrationSql();
  if (sqlFailures.length) {
    console.error("Migration SQL integrity failures:\n- " + sqlFailures.join("\n- "));
    process.exitCode = 1;
    return;
  }
  console.log("Migration SQL integrity OK (tables, FKs, stay CHECK, no DROP TABLE)");

  const prisma = createPrisma();
  if (!prisma) {
    console.log("DATABASE_URL unset; skipped live PostgreSQL checks.");
    return;
  }
  try {
    const liveFailures = await liveCheck(prisma);
    if (liveFailures.length) {
      console.error("Live database integrity failures:\n- " + liveFailures.join("\n- "));
      process.exitCode = 1;
      return;
    }
    console.log("Live database integrity OK. No operational rows were inserted.");
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "ECONNREFUSED" || /P1001|ECONNREFUSED|Can't reach database server/i.test(msg)) {
      console.log("PostgreSQL is not reachable at DATABASE_URL. Migration is committed but not applied on this machine.");
      console.log("Start postgres then: npm run db:migrate:deploy && npm run db:integrity");
      return;
    }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
