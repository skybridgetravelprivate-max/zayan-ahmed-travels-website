import { config as loadEnv } from "dotenv";
import { resolve } from "path";
loadEnv({ path: resolve(process.cwd(), "../../.env") });
import { PrismaClient, AccountType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../src/password";

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) return new PrismaClient();
  return new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: url,
        max: 5,
        ssl: /sslmode=require|neon\.tech|supabase\.co/i.test(url) ? { rejectUnauthorized: false } : undefined,
      }),
    ),
  });
}

const prisma = createPrisma();

const PERMISSIONS = [
  "dashboard.view",
  "lead.view", "lead.create", "lead.edit", "lead.delete", "lead.assign", "lead.export",
  "customer.view", "customer.create", "customer.edit", "customer.delete", "customer.export",
  "passenger.view", "passenger.create", "passenger.edit", "passenger.delete",
  "followup.view", "followup.create", "followup.edit", "followup.delete",
  "task.view", "task.create", "task.edit", "task.delete",
  "quotation.view", "quotation.create", "quotation.edit", "quotation.delete", "quotation.convert",
  "booking.view", "booking.create", "booking.edit", "booking.cancel", "booking.approve",
  "umrah.view", "umrah.create", "umrah.edit", "umrah.delete",
  "ticket.view", "ticket.create", "ticket.edit", "ticket.refund", "ticket.reissue", "ticket.cancel",
  "hotel.view", "hotel.create", "hotel.edit", "hotel.inventory", "hotel.booking",
  "reservation.view", "reservation.checkin", "reservation.checkout", "reservation.transfer", "reservation.split", "reservation.cancel",
  "star.view", "star.create", "star.edit", "star.allocate",
  "complaint.view", "complaint.create", "complaint.edit", "complaint.assign", "complaint.resolve", "complaint.close", "complaint.delete",
  "transport.view", "transport.create", "transport.edit", "transport.delete",
  "visa.view", "visa.create", "visa.edit", "visa.approve",
  "agent.view", "agent.create", "agent.edit", "agent.delete",
  "supplier.view", "supplier.create", "supplier.edit", "supplier.delete",
  "account.view", "account.create", "account.edit", "account.post", "account.reverse",
  "hr.view", "hr.create", "hr.edit", "hr.delete",
  "report.view", "report.export",
  "document.view", "document.create", "document.delete",
  "notification.view",
  "cms.view", "cms.edit",
  "user.manage", "role.manage", "settings.manage", "audit.view", "branch.manage",
  "admin.post", "admin.discount", "admin.advance", "admin.delete", "admin.import", "admin.export",
  "account.adjust",
];

const COA: { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Assets", type: "ASSET" },
  { code: "1100", name: "Cash", type: "ASSET" },
  { code: "1200", name: "Bank", type: "ASSET" },
  { code: "1300", name: "Accounts Receivable", type: "ASSET" },
  { code: "2000", name: "Liabilities", type: "LIABILITY" },
  { code: "2100", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2200", name: "Agent Commission Payable", type: "LIABILITY" },
  { code: "3000", name: "Equity", type: "EQUITY" },
  { code: "3100", name: "Owner Capital", type: "EQUITY" },
  { code: "4000", name: "Revenue", type: "REVENUE" },
  { code: "4100", name: "Umrah Sales", type: "REVENUE" },
  { code: "4200", name: "Ticket Sales", type: "REVENUE" },
  { code: "4300", name: "Hotel Sales", type: "REVENUE" },
  { code: "4400", name: "Transport Sales", type: "REVENUE" },
  { code: "4500", name: "Visa Sales", type: "REVENUE" },
  { code: "4600", name: "Service Sales", type: "REVENUE" },
  { code: "5000", name: "Expenses", type: "EXPENSE" },
  { code: "5100", name: "Cost of Sales", type: "EXPENSE" },
  { code: "5200", name: "Operating Expenses", type: "EXPENSE" },
  { code: "5300", name: "Salary Expense", type: "EXPENSE" },
];

async function main() {
  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  const allPerms = await prisma.permission.findMany();
  const roleMap: Record<string, string[]> = {
    SUPER_ADMIN: PERMISSIONS,
    "Super Admin": PERMISSIONS,
    ADMIN: PERMISSIONS.filter((p) => p !== "admin.delete"),
    Admin: PERMISSIONS.filter((p) => p !== "admin.delete"),
    MANAGER: PERMISSIONS.filter((p) => !["user.manage", "role.manage", "settings.manage", "admin.delete", "branch.manage"].includes(p)),
    Manager: PERMISSIONS.filter((p) => !["user.manage", "role.manage", "settings.manage", "admin.delete", "branch.manage"].includes(p)),
    "Umrah Manager": PERMISSIONS.filter((p) => p.startsWith("umrah.") || p.startsWith("visa.") || p.startsWith("passenger.") || p.startsWith("customer.") || p.startsWith("document.") || ["report.view", "admin.advance", "admin.import", "admin.export", "transport.view", "hotel.view", "reservation.view"].includes(p)),
    Ticketing: PERMISSIONS.filter((p) => p.startsWith("ticket.") || p.startsWith("passenger.") || p.startsWith("document.") || ["customer.view", "report.view"].includes(p)),
    Reservation: PERMISSIONS.filter((p) => p.startsWith("reservation.") || p.startsWith("hotel.") || p.startsWith("star.") || p.startsWith("document.") || ["customer.view", "passenger.view", "report.view", "admin.discount"].includes(p)),
    Accounts: PERMISSIONS.filter((p) => p.startsWith("account.") || p.startsWith("report.") || p.startsWith("document.") || ["customer.view", "admin.post"].includes(p)),
    ACCOUNTANT: PERMISSIONS.filter((p) => p.startsWith("account.") || p.startsWith("report.") || ["customer.view", "admin.post", "document.view"].includes(p)),
    Sales: ["dashboard.view", "customer.view", "customer.create", "customer.edit", "customer.export", "passenger.view", "passenger.create", "umrah.view", "umrah.create", "ticket.view", "hotel.view", "reservation.view", "report.view", "document.view", "document.create"],
    Operations: PERMISSIONS.filter((p) => ["umrah.view", "umrah.edit", "transport.view", "transport.create", "transport.edit", "ticket.view", "reservation.view", "reservation.checkin", "reservation.checkout", "reservation.transfer", "star.view", "complaint.view", "complaint.create", "complaint.edit", "complaint.assign", "complaint.resolve", "complaint.close", "customer.view", "passenger.view", "passenger.edit", "visa.view", "visa.edit", "document.view"].includes(p)),
    Viewer: PERMISSIONS.filter((p) => p.endsWith(".view") || p === "document.create"),
    STAFF: PERMISSIONS.filter((p) => ["umrah.view", "umrah.edit", "transport.view", "ticket.view", "reservation.view", "complaint.view", "customer.view", "passenger.view", "document.view"].includes(p)),
    AGENT: ["dashboard.view", "lead.view", "lead.create", "customer.view", "quotation.view", "booking.view", "umrah.view"],
  };

  for (const [name, codes] of Object.entries(roleMap)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const ids = allPerms.filter((p) => codes.includes(p.code)).map((p) => p.id);
    await prisma.rolePermission.createMany({
      data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  const branch = await prisma.branch.upsert({
    where: { code: "HO" },
    update: {},
    create: {
      name: "Head Office",
      code: "HO",
      address: "Pakistan",
      status: "ACTIVE",
    },
  });

  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Zayan Ahmed Travels (Pvt.) Ltd.",
      country: "Pakistan",
      currencyCode: "PKR",
      timezone: "Asia/Karachi",
      invoicePrefix: "ZAT-INV",
      bookingPrefix: "ZAT-UM",
    },
  });

  for (const c of [
    { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", isBase: true },
    { code: "USD", name: "US Dollar", symbol: "$", isBase: false },
    { code: "SAR", name: "Saudi Riyal", symbol: "﷼", isBase: false },
  ]) {
    await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  for (const a of COA) {
    await prisma.chartOfAccount.upsert({
      where: { code: a.code },
      update: { name: a.name },
      create: { ...a, isPosting: !a.code.endsWith("000") },
    });
  }

  const cash = await prisma.chartOfAccount.findUnique({ where: { code: "1100" } });
  const bank = await prisma.chartOfAccount.findUnique({ where: { code: "1200" } });
  await prisma.cashAccount.upsert({
    where: { id: "cash-main" },
    update: {},
    create: { id: "cash-main", name: "Main Cash", coaId: cash?.id, openingBalance: 0 },
  });
  await prisma.bankAccount.upsert({
    where: { id: "bank-main" },
    update: {},
    create: { id: "bank-main", name: "Main Bank", coaId: bank?.id, openingBalance: 0 },
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@zayanahmedtravels.local";
  const username = process.env.SEED_ADMIN_USERNAME ?? "superadmin";
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is required (set it in .env; do not commit the value)");
  }
  const passwordHash = await hashPassword(password);
  const superRole = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });

  const admin = await prisma.user.upsert({
    where: { email },
    update: process.env.SEED_ADMIN_RESET_PASSWORD === "true" ? { passwordHash } : {},
    create: {
      email,
      username,
      passwordHash,
      fullName: "System Administrator",
      status: "ACTIVE",
      defaultBranchId: branch.id,
    },
  });
  if (superRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superRole.id },
    });
  }
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: admin.id, branchId: branch.id } },
    update: {},
    create: { userId: admin.id, branchId: branch.id },
  });

  await prisma.cmsPage.upsert({
    where: { slug: "home" },
    update: {},
    create: {
      slug: "home",
      title: "Zayan Ahmed Travels",
      body: "Trusted Umrah, ticketing, hotels, transport and visa services.",
      status: "PUBLISHED",
    },
  });

  await prisma.airline.upsert({
    where: { code: "SV" },
    update: {},
    create: { name: "Saudia", code: "SV" },
  });

  const makkah = await prisma.hotel.upsert({
    where: { hotelNumber: "ZAT-HT-SEED-MKK" },
    update: {},
    create: {
      hotelNumber: "ZAT-HT-SEED-MKK",
      name: "Makkah Partner Hotel",
      city: "Makkah",
      country: "Saudi Arabia",
      category: "4",
    },
  });

  const pkg = await prisma.umrahPackage.upsert({
    where: { packageNumber: "ZAT-PKG-SEED-001" },
    update: {},
    create: {
      packageNumber: "ZAT-PKG-SEED-001",
      name: "14-Night Economy Umrah",
      packageType: "ECONOMY",
      durationDays: 14,
      departureCity: "Lahore",
      arrivalCity: "Jeddah",
      makkahHotelId: makkah.id,
      makkahNights: 7,
      madinahNights: 7,
      adultPrice: 285000,
      adultCost: 240000,
      isPublic: true,
      includesVisa: true,
      includesTransport: true,
      includesZiyarat: true,
    },
  });

  const samples = [
    { n: "ZAT-LD-SEED-000001", name: "Ayesha Malik", mobile: "03001112233", city: "Lahore", source: "WHATSAPP" as const, status: "NEW" as const },
    { n: "ZAT-LD-SEED-000002", name: "Usman Raza", mobile: "03004445566", city: "Karachi", source: "FACEBOOK" as const, status: "INTERESTED" as const },
    { n: "ZAT-LD-SEED-000003", name: "Fatima Noor", mobile: "03219876543", city: "Islamabad", source: "WALK_IN" as const, status: "QUOTED" as const },
  ];
  for (const s of samples) {
    const lead = await prisma.lead.upsert({
      where: { leadNumber: s.n },
      update: {},
      create: {
        leadNumber: s.n,
        fullName: s.name,
        mobile: s.mobile,
        city: s.city,
        source: s.source,
        status: s.status,
        assignedUserId: admin.id,
        branchId: branch.id,
        packageId: pkg.id,
        adults: 2,
        visaRequired: true,
      },
    });
    const existingNotes = await prisma.leadNote.count({ where: { leadId: lead.id } });
    if (existingNotes === 0) {
      await prisma.leadNote.create({
        data: { leadId: lead.id, userId: admin.id, body: "Seeded CRM note — follow up on Umrah dates." },
      });
    }
  }

  console.log("Seed complete. Admin:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
