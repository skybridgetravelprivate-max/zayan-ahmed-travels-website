"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PrismaClient, Prisma } = require("../node_modules/@prisma/client");
const bcrypt = require("../node_modules/bcryptjs");

async function main() {
  const databaseUrl =
    process.env.ZAT_SYNTHETIC_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://zat_synthetic@127.0.0.1:55437/zat_synthetic_demo_20261102";

  // Strict target safety check
  const target = new URL(databaseUrl);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname),
    "Database host must be loopback (127.0.0.1)",
  );
  assert.match(
    target.pathname,
    /^\/zat_synthetic_/,
    "Database name must start with zat_synthetic_",
  );

  console.log("Seeding isolated synthetic database:", target.pathname);

  const db = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    const [server] =
      await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(
      server.version >= 170000 && server.version < 180000,
      "PostgreSQL 17 is required",
    );
    console.log("Verified PostgreSQL 17 server version:", server.version);

    // 1. Company Settings
    await db.companySettings.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        companyName: "Zayan Ahmed Travels (Pvt.) Ltd. (Synthetic Demo)",
        country: "Pakistan",
        currencyCode: "PKR",
        timezone: "Asia/Karachi",
        invoicePrefix: "ZAT-INV-DEMO",
        bookingPrefix: "ZAT-UM-DEMO",
      },
    });

    // 2. Branches
    const branchHO = await db.branch.upsert({
      where: { code: "HO" },
      update: {},
      create: {
        code: "HO",
        name: "Head Office (Lahore)",
        address: "Mall Road, Lahore, Pakistan",
        status: "ACTIVE",
      },
    });

    const branchISB = await db.branch.upsert({
      where: { code: "ISB" },
      update: {},
      create: {
        code: "ISB",
        name: "Islamabad Branch",
        address: "Blue Area, Islamabad, Pakistan",
        status: "ACTIVE",
      },
    });

    // 3. Currencies
    for (const c of [
      { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", isBase: true },
      { code: "USD", name: "US Dollar", symbol: "$", isBase: false },
      { code: "SAR", name: "Saudi Riyal", symbol: "﷼", isBase: false },
    ]) {
      await db.currency.upsert({
        where: { code: c.code },
        update: {},
        create: c,
      });
    }

    // 4. Chart of Accounts
    const COA = [
      { code: "1000", name: "Assets", type: "ASSET", isPosting: false },
      { code: "1100", name: "Cash", type: "ASSET", isPosting: true },
      { code: "1200", name: "Bank", type: "ASSET", isPosting: true },
      { code: "1300", name: "Accounts Receivable", type: "ASSET", isPosting: true },
      { code: "2000", name: "Liabilities", type: "LIABILITY", isPosting: false },
      { code: "2100", name: "Accounts Payable", type: "LIABILITY", isPosting: true },
      { code: "2200", name: "Agent Commission Payable", type: "LIABILITY", isPosting: true },
      { code: "3000", name: "Equity", type: "EQUITY", isPosting: false },
      { code: "3100", name: "Owner Capital", type: "EQUITY", isPosting: true },
      { code: "4000", name: "Revenue", type: "REVENUE", isPosting: false },
      { code: "4100", name: "Umrah Sales", type: "REVENUE", isPosting: true },
      { code: "4200", name: "Ticket Sales", type: "REVENUE", isPosting: true },
      { code: "4300", name: "Hotel Sales", type: "REVENUE", isPosting: true },
      { code: "4400", name: "Transport Sales", type: "REVENUE", isPosting: true },
      { code: "4500", name: "Visa Sales", type: "REVENUE", isPosting: true },
      { code: "4600", name: "Service Sales", type: "REVENUE", isPosting: true },
      { code: "5000", name: "Expenses", type: "EXPENSE", isPosting: false },
      { code: "5100", name: "Cost of Sales", type: "EXPENSE", isPosting: true },
      { code: "5200", name: "Operating Expenses", type: "EXPENSE", isPosting: true },
      { code: "5300", name: "Salary Expense", type: "EXPENSE", isPosting: true },
    ];

    for (const a of COA) {
      await db.chartOfAccount.upsert({
        where: { code: a.code },
        update: { name: a.name, isPosting: a.isPosting },
        create: a,
      });
    }

    const coaCash = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1100" } });
    const coaBank = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1200" } });

    await db.cashAccount.upsert({
      where: { id: "cash-main" },
      update: {},
      create: { id: "cash-main", name: "Main Cash (PKR)", coaId: coaCash.id, openingBalance: 0 },
    });

    await db.bankAccount.upsert({
      where: { id: "bank-main" },
      update: {},
      create: { id: "bank-main", name: "Main Bank - Meezan (PKR)", coaId: coaBank.id, openingBalance: 0 },
    });

    // 5. Permissions & Roles
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

    for (const code of PERMISSIONS) {
      await db.permission.upsert({ where: { code }, update: {}, create: { code } });
    }
    const allPerms = await db.permission.findMany();

    const roleDefinitions = {
      SUPER_ADMIN: PERMISSIONS,
      ADMIN: PERMISSIONS.filter((p) => p !== "admin.delete"),
      Sales: [
        "dashboard.view", "lead.view", "lead.create", "lead.edit", "lead.assign", "lead.export",
        "customer.view", "customer.create", "customer.edit", "customer.export",
        "passenger.view", "passenger.create", "passenger.edit",
        "followup.view", "followup.create", "followup.edit", "followup.delete",
        "task.view", "task.create", "task.edit",
        "quotation.view", "quotation.create", "quotation.edit", "quotation.convert",
        "booking.view", "booking.create", "booking.edit",
        "umrah.view", "umrah.create", "ticket.view", "hotel.view", "reservation.view",
        "report.view", "document.view", "document.create",
      ],
      STAFF: [
        "dashboard.view", "customer.view", "passenger.view", "umrah.view", "ticket.view",
        "reservation.view", "complaint.view", "document.view",
      ],
      ACCOUNTANT: PERMISSIONS.filter((p) => p.startsWith("account.") || p.startsWith("report.") || ["customer.view", "admin.post", "document.view"].includes(p)),
      Operations: PERMISSIONS.filter((p) => [
        "umrah.view", "umrah.edit", "transport.view", "transport.create", "transport.edit",
        "ticket.view", "reservation.view", "reservation.checkin", "reservation.checkout",
        "complaint.view", "complaint.create", "complaint.edit", "complaint.assign", "complaint.resolve",
        "customer.view", "passenger.view", "passenger.edit", "visa.view", "visa.edit", "document.view"
      ].includes(p)),
    };

    const roles = {};
    for (const [name, codes] of Object.entries(roleDefinitions)) {
      const role = await db.role.upsert({
        where: { name },
        update: {},
        create: { name, isSystem: true },
      });
      roles[name] = role;
      await db.rolePermission.deleteMany({ where: { roleId: role.id } });
      const ids = allPerms.filter((p) => codes.includes(p.code)).map((p) => p.id);
      await db.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    // 6. Users (Hashed Passwords)
    const adminPasswordHash = await bcrypt.hash("SyntheticAdmin2026!", 10);
    const staffPasswordHash = await bcrypt.hash("SyntheticStaff2026!", 10);
    const accountantPasswordHash = await bcrypt.hash("SyntheticAccountant2026!", 10);
    const customerPasswordHash = await bcrypt.hash("SyntheticCustomer2026!", 10);

    // Super Admin
    const superAdmin = await db.user.upsert({
      where: { email: "superadmin@example.com" },
      update: { passwordHash: adminPasswordHash, status: "ACTIVE" },
      create: {
        email: "superadmin@example.com",
        username: "superadmin_demo",
        passwordHash: adminPasswordHash,
        fullName: "Synthetic Super Administrator",
        status: "ACTIVE",
        defaultBranchId: branchHO.id,
      },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: superAdmin.id, roleId: roles.SUPER_ADMIN.id } },
      update: {},
      create: { userId: superAdmin.id, roleId: roles.SUPER_ADMIN.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: superAdmin.id, branchId: branchHO.id } },
      update: {},
      create: { userId: superAdmin.id, branchId: branchHO.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: superAdmin.id, branchId: branchISB.id } },
      update: {},
      create: { userId: superAdmin.id, branchId: branchISB.id },
    });

    // Admin
    const adminUser = await db.user.upsert({
      where: { email: "admin@example.com" },
      update: { passwordHash: adminPasswordHash, status: "ACTIVE" },
      create: {
        email: "admin@example.com",
        username: "admin_demo",
        passwordHash: adminPasswordHash,
        fullName: "Synthetic Branch Administrator",
        status: "ACTIVE",
        defaultBranchId: branchHO.id,
      },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: roles.ADMIN.id } },
      update: {},
      create: { userId: adminUser.id, roleId: roles.ADMIN.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: adminUser.id, branchId: branchHO.id } },
      update: {},
      create: { userId: adminUser.id, branchId: branchHO.id },
    });

    // Staff / Sales (Branch HO)
    const staffUser = await db.user.upsert({
      where: { email: "staff@example.com" },
      update: { passwordHash: staffPasswordHash, status: "ACTIVE" },
      create: {
        email: "staff@example.com",
        username: "staff_demo",
        passwordHash: staffPasswordHash,
        fullName: "Synthetic Sales Executive",
        status: "ACTIVE",
        defaultBranchId: branchHO.id,
      },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: staffUser.id, roleId: roles.Sales.id } },
      update: {},
      create: { userId: staffUser.id, roleId: roles.Sales.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: staffUser.id, branchId: branchHO.id } },
      update: {},
      create: { userId: staffUser.id, branchId: branchHO.id },
    });

    // Foreign Staff (Branch ISB)
    const foreignStaffUser = await db.user.upsert({
      where: { email: "foreign_staff@example.com" },
      update: { passwordHash: staffPasswordHash, status: "ACTIVE" },
      create: {
        email: "foreign_staff@example.com",
        username: "foreign_staff_demo",
        passwordHash: staffPasswordHash,
        fullName: "Synthetic Islamabad Sales",
        status: "ACTIVE",
        defaultBranchId: branchISB.id,
      },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: foreignStaffUser.id, roleId: roles.Sales.id } },
      update: {},
      create: { userId: foreignStaffUser.id, roleId: roles.Sales.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: foreignStaffUser.id, branchId: branchISB.id } },
      update: {},
      create: { userId: foreignStaffUser.id, branchId: branchISB.id },
    });

    // Accountant
    const accountantUser = await db.user.upsert({
      where: { email: "accountant@example.com" },
      update: { passwordHash: accountantPasswordHash, status: "ACTIVE" },
      create: {
        email: "accountant@example.com",
        username: "accountant_demo",
        passwordHash: accountantPasswordHash,
        fullName: "Synthetic Senior Accountant",
        status: "ACTIVE",
        defaultBranchId: branchHO.id,
      },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: accountantUser.id, roleId: roles.ACCOUNTANT.id } },
      update: {},
      create: { userId: accountantUser.id, roleId: roles.ACCOUNTANT.id },
    });
    await db.userBranch.upsert({
      where: { userId_branchId: { userId: accountantUser.id, branchId: branchHO.id } },
      update: {},
      create: { userId: accountantUser.id, branchId: branchHO.id },
    });

    // 7. Suppliers & Airlines
    const supplierHotel = await db.supplier.upsert({
      where: { id: "sup-hotel-demo-01" },
      update: {},
      create: {
        id: "sup-hotel-demo-01",
        name: "Rawabi Al-Haram Hospitality Co.",
        company: "Rawabi Group (Saudi Arabia)",
        kind: "HOTEL",
        contact: "Sheikh Ibrahim Synthetic (+966500000001)",
        email: "supplier-hotels@example.com",
        address: "Ibrahim Khalil Road, Makkah, KSA",
        currency: "SAR",
      },
    });

    const supplierTransport = await db.supplier.upsert({
      where: { id: "sup-trans-demo-01" },
      update: {},
      create: {
        id: "sup-trans-demo-01",
        name: "Al-Safwah Transport Co.",
        company: "Al-Safwah Group (Saudi Arabia)",
        kind: "TRANSPORT",
        contact: "Abdul Rahman Synthetic (+966500000002)",
        email: "supplier-transport@example.com",
        address: "Madinah Road, Jeddah, KSA",
        currency: "SAR",
      },
    });

    const supplierFlights = await db.supplier.upsert({
      where: { id: "sup-air-demo-01" },
      update: {},
      create: {
        id: "sup-air-demo-01",
        name: "Falcon Global Ticketing Consolidator",
        company: "Falcon Aviation Pvt Ltd",
        kind: "TICKET",
        contact: "Kamran Synthetic (+922100000001)",
        email: "supplier-flights@example.com",
        address: "Shar-e-Faisal, Karachi, Pakistan",
        currency: "PKR",
      },
    });

    for (const a of [
      { code: "SV", name: "Saudia" },
      { code: "PK", name: "Pakistan International Airlines" },
      { code: "PA", name: "Airblue" },
    ]) {
      await db.airline.upsert({ where: { code: a.code }, update: {}, create: a });
    }

    // 8. Hotels & Room Types
    const hotelMkk = await db.hotel.upsert({
      where: { hotelNumber: "ZAT-HT-MKK-01" },
      update: {},
      create: {
        hotelNumber: "ZAT-HT-MKK-01",
        name: "Makkah Royal Clock Synthetic Hotel",
        city: "Makkah",
        country: "Saudi Arabia",
        category: "5",
        distance: "50m",
        supplierId: supplierHotel.id,
      },
    });

    const hotelMed = await db.hotel.upsert({
      where: { hotelNumber: "ZAT-HT-MED-01" },
      update: {},
      create: {
        hotelNumber: "ZAT-HT-MED-01",
        name: "Madinah Oasis Synthetic Palace",
        city: "Madinah",
        country: "Saudi Arabia",
        category: "4",
        distance: "150m",
        supplierId: supplierHotel.id,
      },
    });

    const hotelMkkTower = await db.hotel.upsert({
      where: { hotelNumber: "ZAT-HT-MKK-02" },
      update: {},
      create: {
        hotelNumber: "ZAT-HT-MKK-02",
        name: "Makkah Grand Synthetic Tower",
        city: "Makkah",
        country: "Saudi Arabia",
        category: "4",
        distance: "300m",
        supplierId: supplierHotel.id,
      },
    });

    const roomTypeMkkQuad = await db.hotelRoomType.upsert({
      where: { id: "room-type-mkk-quad" },
      update: {},
      create: {
        id: "room-type-mkk-quad",
        hotelId: hotelMkk.id,
        name: "Quad Room (4-Bed)",
        occupancy: 4,
        sellingRate: 18000.0,
        costRate: 15000.0,
      },
    });

    const roomTypeMkkDouble = await db.hotelRoomType.upsert({
      where: { id: "room-type-mkk-double" },
      update: {},
      create: {
        id: "room-type-mkk-double",
        hotelId: hotelMkk.id,
        name: "Double Room (2-Bed)",
        occupancy: 2,
        sellingRate: 26000.0,
        costRate: 22000.0,
      },
    });

    const roomTypeMedDouble = await db.hotelRoomType.upsert({
      where: { id: "room-type-med-double" },
      update: {},
      create: {
        id: "room-type-med-double",
        hotelId: hotelMed.id,
        name: "Double Room (2-Bed)",
        occupancy: 2,
        sellingRate: 20000.0,
        costRate: 17000.0,
      },
    });

    const roomTypeTowerDouble = await db.hotelRoomType.upsert({
      where: { id: "room-type-tower-double" },
      update: {},
      create: {
        id: "room-type-tower-double",
        hotelId: hotelMkkTower.id,
        name: "Double Room (2-Bed)",
        occupancy: 2,
        sellingRate: 20000.0,
        costRate: 16000.0,
      },
    });

    // 9. Vehicles & Drivers
    await db.vehicle.upsert({
      where: { plateNumber: "SYN-KHI-4042" },
      update: {},
      create: {
        plateNumber: "SYN-KHI-4042",
        type: "COASTER",
        capacity: 25,
        status: "ACTIVE",
        supplierId: supplierTransport.id,
      },
    });

    await db.driver.upsert({
      where: { id: "driver-rashid-01" },
      update: {},
      create: {
        id: "driver-rashid-01",
        fullName: "Muhammad Rashid",
        phone: "+966501112233",
        licenseNo: "KSA-DRV-001",
        status: "ACTIVE",
        supplierId: supplierTransport.id,
      },
    });

    // 10. Visa Types
    await db.visaType.upsert({
      where: { code: "UMRAH-EV" },
      update: {},
      create: {
        code: "UMRAH-EV",
        name: "Umrah Electronic Visa",
        category: "UMRAH",
        status: "ACTIVE",
      },
    });

    // 11. Umrah Packages
    const packageEconomy = await db.umrahPackage.upsert({
      where: { packageNumber: "ZAT-PKG-SYN-01" },
      update: {},
      create: {
        packageNumber: "ZAT-PKG-SYN-01",
        name: "14-Night Economy Synthetic Umrah",
        packageType: "ECONOMY",
        durationDays: 14,
        departureCity: "Lahore",
        arrivalCity: "Jeddah",
        makkahHotelId: hotelMkk.id,
        makkahNights: 7,
        madinahHotelId: hotelMed.id,
        madinahNights: 7,
        adultPrice: 285000.0,
        adultCost: 240000.0,
        isPublic: true,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
      },
    });

    const packageExecutive = await db.umrahPackage.upsert({
      where: { packageNumber: "ZAT-PKG-SYN-02" },
      update: {},
      create: {
        packageNumber: "ZAT-PKG-SYN-02",
        name: "10-Night Executive Synthetic Umrah",
        packageType: "EXECUTIVE",
        durationDays: 10,
        departureCity: "Islamabad",
        arrivalCity: "Madinah",
        makkahHotelId: hotelMkk.id,
        makkahNights: 5,
        madinahHotelId: hotelMed.id,
        madinahNights: 5,
        adultPrice: 465000.0,
        adultCost: 395000.0,
        isPublic: true,
        includesVisa: true,
        includesTransport: true,
        includesZiyarat: true,
      },
    });

    // 12. Synthetic Customers & Website Accounts
    // Customer 1 (Head Office)
    const cust1 = await db.customer.upsert({
      where: { customerNumber: "ZAT-CUST-SYN-001" },
      update: {},
      create: {
        customerNumber: "ZAT-CUST-SYN-001",
        fullName: "Tariq Mahmood",
        phone: "+923001112233",
        email: "customer1@example.com",
        branchId: branchHO.id,
      },
    });

    await db.websiteCustomer.upsert({
      where: { email: "customer1@example.com" },
      update: { passwordHash: customerPasswordHash },
      create: {
        id: "web-cust-demo-001",
        email: "customer1@example.com",
        passwordHash: customerPasswordHash,
        displayName: "Tariq Mahmood",
        crmCustomerId: cust1.id,
      },
    });

    // Customer 2 (Head Office)
    const cust2 = await db.customer.upsert({
      where: { customerNumber: "ZAT-CUST-SYN-002" },
      update: {},
      create: {
        customerNumber: "ZAT-CUST-SYN-002",
        fullName: "Zainab Bibi",
        phone: "+923004445566",
        email: "customer2@example.com",
        branchId: branchHO.id,
      },
    });

    await db.websiteCustomer.upsert({
      where: { email: "customer2@example.com" },
      update: { passwordHash: customerPasswordHash },
      create: {
        id: "web-cust-demo-002",
        email: "customer2@example.com",
        passwordHash: customerPasswordHash,
        displayName: "Zainab Bibi",
        crmCustomerId: cust2.id,
      },
    });

    // Customer 3 (Foreign Branch - Islamabad)
    const cust3 = await db.customer.upsert({
      where: { customerNumber: "ZAT-CUST-SYN-003" },
      update: {},
      create: {
        customerNumber: "ZAT-CUST-SYN-003",
        fullName: "Bilal Ahmed Khan",
        phone: "+923219876543",
        email: "customer3@example.com",
        branchId: branchISB.id,
      },
    });

    await db.websiteCustomer.upsert({
      where: { email: "customer3@example.com" },
      update: { passwordHash: customerPasswordHash },
      create: {
        id: "web-cust-demo-003",
        email: "customer3@example.com",
        passwordHash: customerPasswordHash,
        displayName: "Bilal Ahmed Khan",
        crmCustomerId: cust3.id,
      },
    });

    // 13. Passengers
    const pax1 = await db.passenger.upsert({
      where: { id: "pax-tariq-demo-001" },
      update: {},
      create: {
        id: "pax-tariq-demo-001",
        customerId: cust1.id,
        fullName: "Tariq Mahmood",
        passportNumber: "AB1234561",
        passportExpiryDate: new Date("2032-05-14"),
        dateOfBirth: new Date("1982-05-14"),
        gender: "MALE",
        nationality: "Pakistani",
        mobile: "+923001112233",
      },
    });

    const pax2 = await db.passenger.upsert({
      where: { id: "pax-saima-demo-002" },
      update: {},
      create: {
        id: "pax-saima-demo-002",
        customerId: cust1.id,
        fullName: "Saima Tariq",
        passportNumber: "AB1234562",
        passportExpiryDate: new Date("2033-08-20"),
        dateOfBirth: new Date("1985-08-20"),
        gender: "FEMALE",
        nationality: "Pakistani",
        mobile: "+923001112233",
      },
    });

    // 14. Leads, Follow-ups, Tasks
    const lead1 = await db.lead.upsert({
      where: { leadNumber: "ZAT-LD-SYN-001" },
      update: {},
      create: {
        leadNumber: "ZAT-LD-SYN-001",
        fullName: "Ahmad Raza",
        mobile: "+923001230001",
        email: "ahmad-inquiry@example.com",
        city: "Lahore",
        source: "WEBSITE",
        status: "NEW",
        adults: 2,
        budget: 570000.0,
        branchId: branchHO.id,
        packageId: packageEconomy.id,
        assignedUserId: staffUser.id,
      },
    });

    const lead2 = await db.lead.upsert({
      where: { leadNumber: "ZAT-LD-SYN-002" },
      update: {},
      create: {
        leadNumber: "ZAT-LD-SYN-002",
        fullName: "Farhan Saeed",
        mobile: "+923001230002",
        email: "farhan-lead@example.com",
        city: "Islamabad",
        source: "WHATSAPP",
        status: "CONTACTED",
        adults: 4,
        budget: 1140000.0,
        branchId: branchISB.id,
        packageId: packageEconomy.id,
        assignedUserId: foreignStaffUser.id,
      },
    });

    const lead3 = await db.lead.upsert({
      where: { leadNumber: "ZAT-LD-SYN-003" },
      update: {},
      create: {
        leadNumber: "ZAT-LD-SYN-003",
        fullName: "Sadia Qureshi",
        mobile: "+923001230003",
        email: "sadia-lead@example.com",
        city: "Lahore",
        source: "WALK_IN",
        status: "QUOTED",
        adults: 2,
        budget: 930000.0,
        branchId: branchHO.id,
        packageId: packageExecutive.id,
        assignedUserId: staffUser.id,
      },
    });

    // Follow-ups
    const past2Days = new Date(Date.now() - 2 * 86400000);
    const today = new Date();
    const future3Days = new Date(Date.now() + 3 * 86400000);

    await db.followUp.create({
      data: {
        leadId: lead1.id,
        subject: "Overdue call on visa requirements",
        dueAt: past2Days,
        status: "PENDING",
        priority: "HIGH",
      },
    });

    await db.followUp.create({
      data: {
        leadId: lead3.id,
        subject: "Discuss Executive package itinerary options",
        dueAt: today,
        status: "PENDING",
        priority: "MEDIUM",
      },
    });

    await db.followUp.create({
      data: {
        customerId: cust1.id,
        subject: "Pre-departure luggage & ziyarat briefing",
        dueAt: future3Days,
        status: "PENDING",
        priority: "LOW",
      },
    });

    await db.followUp.create({
      data: {
        customerId: cust2.id,
        subject: "Initial inquiry completed",
        dueAt: past2Days,
        status: "COMPLETED",
        priority: "LOW",
      },
    });

    // Tasks
    await db.task.create({
      data: {
        title: "Verify passport validity and photo specs for Umrah group",
        assignedUserId: staffUser.id,
        customerId: cust1.id,
        dueDate: today,
        priority: "HIGH",
        status: "TODO",
      },
    });

    await db.task.create({
      data: {
        title: "Confirm transport reservation with Al-Safwah Co.",
        assignedUserId: staffUser.id,
        dueDate: future3Days,
        priority: "MEDIUM",
        status: "IN_PROGRESS",
      },
    });

    // 15. Complaints
    const comp1 = await db.complaint.upsert({
      where: { complaintNumber: "ZAT-CMP-DEMO-001" },
      update: {},
      create: {
        complaintNumber: "ZAT-CMP-DEMO-001",
        customerId: cust1.id,
        module: "HOTEL",
        category: "ROOM",
        subject: "Madinah room air conditioning required maintenance",
        description: "Room AC airflow was reduced on night 2. Hotel technician resolved within 2 hours.",
        status: "Resolved",
        priority: "High",
        branchId: branchHO.id,
        assignedUserId: staffUser.id,
      },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: comp1.id,
        action: "STATUS_CHANGE",
        body: "Hotel management dispatched technician and resolved AC airflow.",
        userId: staffUser.id,
      },
    });

    await db.complaint.upsert({
      where: { complaintNumber: "ZAT-CMP-DEMO-002" },
      update: {},
      create: {
        complaintNumber: "ZAT-CMP-DEMO-002",
        customerId: cust2.id,
        module: "TICKET",
        category: "FLIGHT",
        subject: "Flight seat allocation adjacent request",
        description: "Requested adjacent window/aisle seats on outbound Saudia flight SV-737.",
        status: "Open",
        priority: "Low",
        branchId: branchHO.id,
        assignedUserId: staffUser.id,
      },
    });

    // 16. Operational Quotation & Converted Umrah Booking with Financial Accounting
    const quote1 = await db.quotation.upsert({
      where: { quotationNumber: "ZAT-QT-DEMO-0001" },
      update: {},
      create: {
        quotationNumber: "ZAT-QT-DEMO-0001",
        customer: { connect: { id: cust1.id } },
        branch: { connect: { id: branchHO.id } },
        status: "CONVERTED",
        costTotal: "480000.00",
        sellingTotal: "570000.00",
        discount: "10000.00",
        tax: "0.00",
        net: "560000.00",
        items: {
          create: [
            {
              description: "14-Night Economy Umrah Package (2 Adults)",
              cost: "480000.00",
              sellingPrice: "570000.00",
              quantity: 1,
            },
          ],
        },
      },
    });

    const booking1 = await db.umrahBooking.upsert({
      where: { bookingNumber: "ZAT-UM-DEMO-0001" },
      update: {},
      create: {
        bookingNumber: "ZAT-UM-DEMO-0001",
        quotation: { connect: { id: quote1.id } },
        customer: { connect: { id: cust1.id } },
        branch: { connect: { id: branchHO.id } },
        package: { connect: { id: packageEconomy.id } },
        status: "CONFIRMED",
        workflowStep: "ADVANCE_PAYMENT",
        cost: "480000.00",
        sellingPrice: "570000.00",
        discount: "10000.00",
        net: "560000.00",
        paid: "200000.00",
        balance: "360000.00",
        departureDate: new Date("2026-12-05"),
        returnDate: new Date("2026-12-19"),
        passengers: {
          create: [
            { passengerId: pax1.id, roomLabel: "MKK-QUAD-1" },
            { passengerId: pax2.id, roomLabel: "MKK-QUAD-1" },
          ],
        },
      },
    });

    // 17. Accounting Journals for Booking 1:
    // Journal 1: Sale Entry (Debit AR 1300: 560000.00, Credit Revenue 4100: 560000.00)
    const jSale = await db.journalEntry.upsert({
      where: { entryNumber: "ZAT-JV-DEMO-0001" },
      update: {},
      create: {
        entryNumber: "ZAT-JV-DEMO-0001",
        date: new Date("2026-11-01"),
        memo: "Umrah package sale for booking ZAT-UM-DEMO-0001",
        status: "POSTED",
        kind: "SALE",
        module: "umrah",
        sourceId: booking1.id,
        branchId: branchHO.id,
        postedAt: new Date("2026-11-01"),
        lines: {
          create: [
            {
              accountId: (await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1300" } })).id,
              debit: "560000.00",
              credit: "0.00",
              partyType: "customer",
              partyId: cust1.id,
              memo: "AR for Tariq Mahmood",
            },
            {
              accountId: (await db.chartOfAccount.findUniqueOrThrow({ where: { code: "4100" } })).id,
              debit: "0.00",
              credit: "560000.00",
              memo: "Umrah Sales Revenue",
            },
          ],
        },
      },
    });

    // Journal 2: Cost Entry (Debit COGS 5100: 480000.00, Credit AP 2100: 480000.00)
    const jCost = await db.journalEntry.upsert({
      where: { entryNumber: "ZAT-JV-DEMO-0002" },
      update: {},
      create: {
        entryNumber: "ZAT-JV-DEMO-0002",
        date: new Date("2026-11-01"),
        memo: "Umrah package cost for booking ZAT-UM-DEMO-0001",
        status: "POSTED",
        kind: "COST",
        module: "umrah",
        sourceId: booking1.id,
        branchId: branchHO.id,
        postedAt: new Date("2026-11-01"),
        lines: {
          create: [
            {
              accountId: (await db.chartOfAccount.findUniqueOrThrow({ where: { code: "5100" } })).id,
              debit: "480000.00",
              credit: "0.00",
              memo: "Cost of Goods Sold - Umrah",
            },
            {
              accountId: (await db.chartOfAccount.findUniqueOrThrow({ where: { code: "2100" } })).id,
              debit: "0.00",
              credit: "480000.00",
              partyType: "supplier",
              partyId: supplierHotel.id,
              memo: "Payable to Rawabi Al-Haram Co.",
            },
          ],
        },
      },
    });

    // Journal 3: Advance Receipt (Debit Bank 1200: 200000.00, Credit AR 1300: 200000.00)
    const jReceipt = await db.journalEntry.upsert({
      where: { entryNumber: "ZAT-JV-DEMO-0003" },
      update: {},
      create: {
        entryNumber: "ZAT-JV-DEMO-0003",
        date: new Date("2026-11-02"),
        memo: "Advance receipt for booking ZAT-UM-DEMO-0001",
        status: "POSTED",
        kind: "RECEIPT",
        module: "accounts",
        sourceId: booking1.id,
        branchId: branchHO.id,
        postedAt: new Date("2026-11-02"),
        lines: {
          create: [
            {
              accountId: coaBank.id,
              debit: "200000.00",
              credit: "0.00",
              memo: "Bank receipt - Meezan Bank",
            },
            {
              accountId: (await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1300" } })).id,
              debit: "0.00",
              credit: "200000.00",
              partyType: "customer",
              partyId: cust1.id,
              memo: "AR credit for Tariq Mahmood",
            },
          ],
        },
      },
    });

    // Receipt Record
    await db.receipt.upsert({
      where: { receiptNo: "ZAT-RC-DEMO-0001" },
      update: {},
      create: {
        receiptNo: "ZAT-RC-DEMO-0001",
        bookingId: booking1.id,
        customerId: cust1.id,
        amount: "200000.00",
        method: "BANK",
        bankAccountId: "bank-main",
        journalId: jReceipt.id,
      },
    });

    // 18. FIXTURES REPRODUCING THE 5 CONFIRMED CODE REVIEW DEFECTS

    // Fixture for Finding #2: Receivables report clamped at 200 rows
    // Seed 250 synthetic customer balances to verify that CSV export truncates 250 rows to 200
    console.log("Seeding 250 receivable fixtures for CSV export finding #2...");
    const coaAR = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "1300" } });
    const coaRev = await db.chartOfAccount.findUniqueOrThrow({ where: { code: "4600" } });

    const custFixtures = [];
    for (let i = 1; i <= 250; i++) {
      custFixtures.push({
        customerNumber: `ZAT-CUST-CSV-${String(i).padStart(3, "0")}`,
        fullName: `Synthetic Receivable Customer ${i}`,
        phone: `+923000000${String(i).padStart(3, "0")}`,
        email: `receivable-${i}@example.com`,
        branchId: branchHO.id,
      });
    }
    await db.customer.createMany({ data: custFixtures, skipDuplicates: true });

    const seededCusts = await db.customer.findMany({
      where: { customerNumber: { startsWith: "ZAT-CUST-CSV-" } },
      select: { id: true, customerNumber: true, fullName: true },
      orderBy: { customerNumber: "asc" },
    });

    // Create posted journal lines with debit to 1300 (AR) for each of the 250 customers
    await db.journalEntry.upsert({
      where: { entryNumber: "ZAT-JV-CSV-250" },
      update: {},
      create: {
        entryNumber: "ZAT-JV-CSV-250",
        date: new Date("2026-11-01"),
        memo: "Synthetic 250-receivables test batch for CSV clamp finding",
        status: "POSTED",
        kind: "SALE",
        postedAt: new Date("2026-11-01"),
        lines: {
          create: [
            ...seededCusts.map((c) => ({
              accountId: coaAR.id,
              debit: "100.00",
              credit: "0.00",
              partyType: "customer",
              partyId: c.id,
              memo: `Receivable for ${c.fullName}`,
            })),
            {
              accountId: coaRev.id,
              debit: "0.00",
              credit: new Prisma.Decimal("100.00").mul(seededCusts.length).toFixed(2),
              memo: "Revenue offset for 250 customers",
            },
          ],
        },
      },
    });

    // Fixture for Finding #3 & #4: Mixed Segmented vs Legacy Stays and Daily Hotel Detail Collision
    console.log("Seeding HotelStaySegment and Legacy HotelBooking fixtures for findings #3 and #4...");
    const hotelBooking1 = await db.hotelBooking.upsert({
      where: { bookingNumber: "ZAT-HB-DEMO-SEG" },
      update: {},
      create: {
        bookingNumber: "ZAT-HB-DEMO-SEG",
        customerId: cust1.id,
        hotelId: hotelMkk.id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-12"),
        nights: 2,
        rooms: 1,
        net: "60000.00",
        status: "CONFIRMED",
      },
    });

    await db.hotelStaySegment.upsert({
      where: { id: "stay-seg-demo-001" },
      update: {},
      create: {
        id: "stay-seg-demo-001",
        bookingId: hotelBooking1.id,
        hotelId: hotelMkk.id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-12"),
        nights: 2,
        status: "CONFIRMED",
        rooms: {
          create: [
            {
              sellingPrice: "60000.00",
              roomTypeId: roomTypeMkkQuad.id,
              pax: {
                create: [{ passengerId: pax1.id }, { passengerId: pax2.id }],
              },
            },
          ],
        },
      },
    });

    // Segmented Stay in Hotel B (Makkah Grand Tower) on the SAME DATES (2026-12-10 to 2026-12-12)
    // to reproduce Finding #4: Daily hotel detail merges Hotel B into Hotel A
    const hotelBooking2 = await db.hotelBooking.upsert({
      where: { bookingNumber: "ZAT-HB-DEMO-TOWER" },
      update: {},
      create: {
        bookingNumber: "ZAT-HB-DEMO-TOWER",
        customerId: cust2.id,
        hotelId: hotelMkkTower.id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-12"),
        nights: 2,
        rooms: 1,
        net: "40000.00",
        status: "CONFIRMED",
      },
    });

    await db.hotelStaySegment.upsert({
      where: { id: "stay-seg-demo-002" },
      update: {},
      create: {
        id: "stay-seg-demo-002",
        bookingId: hotelBooking2.id,
        hotelId: hotelMkkTower.id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-12"),
        nights: 2,
        status: "CONFIRMED",
        rooms: {
          create: [
            {
              sellingPrice: "40000.00",
              roomTypeId: roomTypeTowerDouble.id,
              pax: {
                create: [{ passengerId: pax1.id }],
              },
            },
          ],
        },
      },
    });

    // Legacy HotelBooking without segments (to reproduce Finding #3: suppressed when segments exist)
    await db.hotelBooking.upsert({
      where: { bookingNumber: "ZAT-HB-DEMO-LEGACY" },
      update: {},
      create: {
        bookingNumber: "ZAT-HB-DEMO-LEGACY",
        customerId: cust3.id,
        hotelId: hotelMed.id,
        roomTypeId: roomTypeMedDouble.id,
        checkIn: new Date("2026-12-15"),
        checkOut: new Date("2026-12-18"),
        nights: 3,
        rooms: 1,
        net: "45000.00",
        status: "CONFIRMED",
      },
    });

    // Fixture for Finding #5: Approval report date filtering ignored for historical bookings
    // Create an Umrah Booking with createdAt in 2020
    console.log("Seeding historical 2020 UmrahBooking fixture for finding #5...");
    await db.umrahBooking.upsert({
      where: { bookingNumber: "ZAT-UM-HIST-2020" },
      update: {},
      create: {
        bookingNumber: "ZAT-UM-HIST-2020",
        customerId: cust1.id,
        branchId: branchHO.id,
        status: "CONFIRMED",
        net: "150000.00",
        createdAt: new Date("2020-05-15T00:00:00Z"),
      },
    });

    // 19. Summary of Seeded Data
    const tableCounts = {
      branches: await db.branch.count(),
      users: await db.user.count(),
      websiteCustomers: await db.websiteCustomer.count(),
      customers: await db.customer.count(),
      passengers: await db.passenger.count(),
      leads: await db.lead.count(),
      followUps: await db.followUp.count(),
      tasks: await db.task.count(),
      quotations: await db.quotation.count(),
      umrahBookings: await db.umrahBooking.count(),
      hotelBookings: await db.hotelBooking.count(),
      hotelStaySegments: await db.hotelStaySegment.count(),
      suppliers: await db.supplier.count(),
      hotels: await db.hotel.count(),
      hotelRoomTypes: await db.hotelRoomType.count(),
      vehicles: await db.vehicle.count(),
      drivers: await db.driver.count(),
      visaTypes: await db.visaType.count(),
      packages: await db.umrahPackage.count(),
      journalEntries: await db.journalEntry.count(),
      journalLines: await db.journalLine.count(),
      receipts: await db.receipt.count(),
      complaints: await db.complaint.count(),
      complaintEvents: await db.complaintEvent.count(),
    };

    console.log("Synthetic Demo Seeding Completed Successfully!");
    console.log(JSON.stringify(tableCounts, null, 2));

    return tableCounts;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  });
}

module.exports = { main };
