"use strict";
// Real Chrome + packaged gateway. Explicitly disposable synthetic PG17 only.
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { spawn } = require("node:child_process");
const { randomUUID, randomBytes } = require("node:crypto");
const { PrismaClient } = require("../node_modules/@prisma/client");
const bcrypt = require("../node_modules/bcryptjs");

async function main() {
  const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, "127.0.0.1");
  assert.match(target.pathname, /^\/zat_synthetic_crm_admin_[a-z0-9_]+$/);
  const root = path.resolve(__dirname, "../.."),
    output = path.resolve(process.env.ZAT_SYNTHETIC_BROWSER_OUTPUT);
  fs.mkdirSync(output, { recursive: true });
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  let browser,
    child,
    log,
    completed = false;
  const checks = [];
  try {
    const [server] =
      await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(server.version >= 170000 && server.version < 180000);
    for (const file of [".env", "backend/.env", ".next/standalone/.env"])
      assert.ok(
        !fs.existsSync(path.join(root, file)),
        "Real environment files must not be loaded",
      );
    for (let directory=root;;directory=path.dirname(directory)) {
      for (const name of [".env", ".env.production", "nodejs/.env"]) assert.ok(!fs.existsSync(path.join(directory,name)), "Ancestor environment files must not enter synthetic tests");
      if (path.dirname(directory)===directory) break;
    }
    const tag = randomUUID(),
      password = `Synthetic-${randomBytes(18).toString("hex")}!`,
      hash = await bcrypt.hash(password, 10);
    const branch = await db.branch.create({
      data: { code: "SYN-"+tag.slice(0,8), name: "Synthetic browser office" },
    });
    const foreignBranch = await db.branch.create({
      data: { code: randomUUID(), name: "Synthetic foreign office" },
    });
    async function role(name, codes) {
      const permissions = await Promise.all(
        codes.map((code) =>
          db.permission.upsert({
            where: { code },
            update: {},
            create: { code },
          }),
        ),
      );
      return db.role.create({
        data: {
          name,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });
    }
    const salesRole = await role(`Synthetic sales ${tag}`, [
      "lead.view",
      "lead.create",
      "lead.edit",
      "lead.assign",
      "followup.view",
      "followup.create",
      "followup.edit",
      "task.view",
      "task.create",
      "task.edit",
      "quotation.view",
      "quotation.create",
      "quotation.edit",
      "booking.view",
      "booking.create",
      "customer.view",
      "customer.create",
      "customer.edit",
      "document.view",
    ]);
    const limitedRole = await role(`Synthetic limited ${tag}`, ["lead.view"]);
    const operationsRole = await role(`Synthetic operations ${tag}`, [
      "hotel.view",
      "hotel.booking",
      "reservation.checkin",
      "reservation.checkout",
    ]);
    const websiteRole=await role(`Synthetic website ${tag}`,["cms.view"]);
    const adminRole = await db.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: { name: "SUPER_ADMIN" },
    });
    async function user(prefix, selectedRole, branchId = branch.id) {
      return db.user.create({
        data: {
          username: `${prefix}-${tag}`,
          email: `${prefix}-${tag}@example.test`,
          fullName: `Synthetic ${prefix}`,
          passwordHash: hash,
          defaultBranchId: branchId,
          roles: { create: { roleId: selectedRole.id } },
        },
      });
    }
    const operations = await user("operations", operationsRole);
    const website=await user("website",websiteRole);
    const admin = await user("triage", adminRole),
      staff = await user("sales", salesRole),
      assignee = await user("assigned", salesRole),
      outsider = await user("foreign", salesRole, foreignBranch.id),
      limited = await user("limited", limitedRole);
    const foreignLead = await db.lead.create({
      data: {
        leadNumber: randomUUID(),
        fullName: "Foreign inquiry must stay private",
        mobile: "+00000000",
        branchId: foreignBranch.id,
      },
    });
    const customer = await db.customer.create({
      data: {
        customerNumber: randomUUID(),
        fullName: "Synthetic customer-only owner",
        branchId: branch.id,
      },
    });
    const past = new Date(Date.now() - 3 * 86400000).toISOString();
    await db.followUp.create({
      data: {
        customerId: customer.id,
        subject: "Customer-only due follow-up",
        dueAt: past,
      },
    });
    await db.task.create({
      data: {
        customerId: customer.id,
        title: "Customer-only due task",
        dueDate: past,
      },
    });
    await db.followUp.create({
      data: {
        leadId: foreignLead.id,
        subject: "Foreign due work must stay private",
        dueAt: past,
      },
    });
    const listener = http.createServer();
    await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port;
    await new Promise((resolve) => listener.close(resolve));
    const origin = `http://127.0.0.1:${port}`,
      env = {};
    for (const key of [
      "SystemRoot",
      "WINDIR",
      "TEMP",
      "TMP",
      "PATH",
      "USERPROFILE",
      "LOCALAPPDATA",
      "APPDATA",
    ])
      if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, {
      NODE_ENV: "production",
      START_MODE: "all",
      PORT: String(port),
      GATEWAY_HOST: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: randomBytes(40).toString("hex"),
      JWT_REFRESH_SECRET: randomBytes(40).toString("hex"),
      CUSTOMER_BOOKINGS_INTERNAL_TOKEN: randomBytes(40).toString("hex"),
      APP_URL: origin,
      API_URL: origin,
      CRM_API_URL: origin,
      SITE_URL: origin,
      COOKIE_SECURE: "false",
      DOCUMENT_UPLOADS_ENABLED: "false",
      NEXT_TELEMETRY_DISABLED: "1",
    });
    log = fs.openSync(path.join(output, "packaged-gateway.log"), "w");
    child = spawn(
      process.execPath,
      [path.join(root, ".next/standalone/server.js")],
      { cwd: root, env, stdio: ["ignore", log, log], windowsHide: true },
    );
    const deadline = Date.now() + 60000;
    while (true) {
      try {
        if ((await fetch(origin + "/api/health")).status === 200) break;
      } catch {
        /* Startup is bounded. */
      }
      assert.ok(
        Date.now() < deadline && child.exitCode === null,
        "Packaged synthetic gateway failed readiness",
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const { chromium } = require(process.env.ZAT_PLAYWRIGHT_MODULE);
    browser = await chromium.launch({
      executablePath:
        process.env.ZAT_BROWSER_EXECUTABLE ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: true,
    });
    async function login(identity) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await page.goto(origin + "/admin/login");
      await page.getByLabel("Email or username").fill(identity.username);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page
        .getByRole("button", { name: "Staff sign in", exact: true })
        .click();
      await page.waitForURL(origin + "/admin");
      await page
        .getByRole("heading", {
          name: `Welcome, ${identity.fullName}`,
          exact: true,
        })
        .waitFor();
      return { context, page };
    }
    const triage = await login(admin),
      sales = await login(staff),
      restricted = await login(limited),
      operational = await login(operations);
    const web=await login(website);await web.page.getByRole("link",{name:/^Website pages/}).waitFor();
    assert.equal((await web.context.request.get(origin+"/api/v1/management/cms-pages")).status(),403);
    checks.push("Website-only staff retain their dedicated content destination while generic CMS resource access stays denied");
    await triage.page.screenshot({path:path.join(output,"admin-administrator-dashboard.png"),fullPage:true});
    await operational.page
      .getByRole("heading", { name: "Your workspace", exact: true })
      .waitFor();
    await operational.page
      .getByRole("link", { name: /^Hotel reservations/ })
      .waitFor();
    assert.equal(
      await operational.page
        .getByText(
          "Your account does not have access to an implemented staff workspace.",
          { exact: true },
        )
        .count(),
      0,
    );
    assert.equal(
      (
        await operational.context.request.get(
          origin + "/api/v1/management/leads",
        )
      ).status(),
      403,
    );
    assert.equal(
      (
        await operational.context.request.get(
          origin + "/api/v1/dashboard/workspace",
        )
      ).status(),
      403,
    );
    await triage.page
      .getByRole("heading", { name: "Operational overview", exact: true })
      .waitFor();
    await triage.page
      .getByRole("heading", { name: "Confirmed Umrah bookings", exact: true })
      .waitFor();
    assert.equal(
      await sales.page
        .getByRole("region", { name: "WhatsApp contact" })
        .count(),
      0,
    );
    checks.push(
      "Operations-only role has useful landing and hotel access without dashboard/CRM authority; explicit admin metric labels; staff sales contact absent",
    );
    const anonymous = await browser.newContext(),
      publicPage = await anonymous.newPage();
    await publicPage.goto(origin + "/flights#inquiry");
    const inquiryName = `Synthetic browser inquiry ${tag.slice(0, 8)}`;
    await publicPage.getByLabel("Name", { exact: true }).fill(inquiryName);
    await publicPage.getByLabel("Phone", { exact: true }).fill("+923001234567");
    await publicPage
      .getByLabel("Email", { exact: true })
      .fill(`inquiry-${tag}@example.test`);
    await publicPage
      .locator('textarea[name="message"]')
      .fill(
        "Synthetic local CRM acceptance only; no supplier service requested.",
      );
    await publicPage
      .getByRole("button", { name: "Send flights inquiry", exact: true })
      .click();
    await publicPage
      .getByRole("status")
      .filter({ hasText: /received|submitted|saved/i })
      .waitFor();
    await publicPage
      .getByRole("link", { name: /Chat with .* on WhatsApp/ })
      .waitFor();
    const lead = await db.lead.findFirstOrThrow({
      where: { email: `inquiry-${tag}@example.test` },
    });
    assert.equal(lead.branchId, null);
    assert.equal(
      (
        await sales.context.request.get(origin + `/api/v1/leads/${lead.id}`)
      ).status(),
      404,
    );
    await triage.page.goto(origin + "/admin");
    await triage.page
      .getByText("Awaiting branch triage", { exact: true })
      .waitFor();
    await triage.page.goto(origin + `/admin/manage/leads?record=${lead.id}`);
    await triage.page
      .getByRole("button", { name: "Edit record", exact: true })
      .click();
    await triage.page
      .locator('select[name="branchId"]')
      .selectOption(branch.id);
    await triage.page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await triage.page
      .getByRole("button", { name: "Edit record", exact: true })
      .waitFor();
    assert.equal(
      (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).branchId,
      branch.id,
    );
    checks.push(
      "actual public inquiry creates an unrouted lead; scoped sales cannot read it before explicit super-admin branch triage through the real form",
    );

    const page = sales.page;
    await page.goto(origin + `/admin/manage/leads?record=${lead.id}`);
    await page
      .getByRole("button", { name: "Assign staff", exact: true })
      .click();
    await page
      .locator('select[name="assignedUserId"]')
      .selectOption(assignee.id);
    assert.ok(
      !(
        await page
          .locator('select[name="assignedUserId"] option')
          .evaluateAll((options) => options.map((o) => o.value))
      ).includes(outsider.id),
    );
    await page
      .getByRole("button", { name: "Save assignment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save assignment", exact: true })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("link", { name: "Schedule follow-up", exact: true })
      .waitFor();
    assert.equal(
      (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
        .assignedUserId,
      assignee.id,
    );
    await page
      .getByRole("link", { name: "Schedule follow-up", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Create record", exact: true })
      .waitFor();
    assert.equal(
      await page.locator('select[name="leadId"]').inputValue(),
      lead.id,
    );
    await page
      .locator('[name="subject"]')
      .fill("Browser follow-up requiring action");
    await page.getByLabel(/Due At \(UTC\)/).waitFor();
    await page.locator('[name="dueAt"]').fill(past.slice(0, 16));
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit record", exact: true })
      .waitFor();
    const follow = await db.followUp.findFirstOrThrow({
      where: { leadId: lead.id, subject: "Browser follow-up requiring action" },
    });
    assert.ok(
      (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
        .nextFollowUpAt,
    );
    await page.goto(origin + "/admin");
    await page
      .getByRole("link", { name: follow.subject, exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: "Customer-only due follow-up", exact: true })
      .waitFor();
    await page
      .getByRole("link", { name: "Customer-only due task", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Foreign due work must stay private", { exact: true })
        .count(),
      0,
    );
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `Staff queue overflow at ${width}`,
      );
      await page.screenshot({
        path: path.join(output, `crm-queue-${width}.png`),
        fullPage: true,
      });
    }
    checks.push(
      "actual eligible-staff assignment and lead-context follow-up form; dashboard includes customer-only work, hides foreign work and fits375/768/1440px",
    );
    await page.getByRole("link", { name: follow.subject, exact: true }).click();
    await page
      .getByRole("button", { name: "Edit record", exact: true })
      .click();
    await page.locator('select[name="status"]').selectOption("COMPLETED");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Edit record", exact: true })
      .waitFor();
    assert.equal(
      (await db.lead.findUniqueOrThrow({ where: { id: lead.id } }))
        .nextFollowUpAt,
      null,
    );
    await page.goto(origin + "/admin");
    await page
      .getByRole("heading", { name: "Due work and open sales", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: follow.subject, exact: true })
        .count(),
      0,
    );
    checks.push(
      "completing a follow-up through the real edit form removes stale dashboard work and clears the lead reminder atomically",
    );

    async function json(context, route, method = "GET", body, status = 200) {
      const response = await context.request.fetch(origin + route, {
        method,
        ...(body ? { data: body, headers: { Origin: origin } } : {}),
      });
      assert.equal(response.status(), status, route);
      return response.json();
    }
    const limitedQueue = await json(restricted.context, "/api/v1/crm/today");
    assert.deepEqual(limitedQueue.overdueFollowUps, []);
    assert.deepEqual(limitedQueue.tasksDue, []);
    assert.deepEqual(limitedQueue.openQuotes, []);
    const limitedStats = await json(restricted.context, "/api/v1/crm/stats");
    assert.equal(limitedStats.overdueFollowUps, null);
    assert.equal(
      (
        await restricted.context.request.post(
          origin + "/api/v1/crm/leads/bulk",
          {
            data: {
              ids: [lead.id],
              action: "assign",
              assignedUserId: outsider.id,
            },
            headers: { Origin: origin },
          },
        )
      ).status(),
      403,
    );
    assert.equal(
      (
        await sales.context.request.get(
          origin + `/api/v1/crm/leads/${foreignLead.id}/workspace`,
        )
      ).status(),
      404,
    );
    const state = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(
      (
        await sales.context.request.post(
          origin + `/api/v1/crm/leads/${lead.id}/assign`,
          {
            data: {
              assignedUserId: outsider.id,
              version: state.updatedAt.toISOString(),
            },
            headers: { Origin: origin },
          },
        )
      ).status(),
      400,
    );
    await json(sales.context, `/api/v1/leads/${lead.id}`, "PATCH", {
      budget: "1000.50",
    });
    await page.goto(origin + `/admin/manage/leads?record=${lead.id}`);
    await page
      .getByRole("button", { name: "Create quotation", exact: true })
      .click();
    await page.locator('input[name="confirm"]').check();
    await page
      .getByRole("button", { name: "Confirm create quotation", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Create quotation", exact: true })
      .waitFor({ state: "hidden" });
    const quote = await db.quotation.findFirstOrThrow({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
    });
    await page
      .getByRole("heading", {
        name: "Related work & recorded activity",
        exact: true,
      })
      .waitFor();
    assert.equal(Number(quote.net), 1000.5);
    assert.ok(quote.customerId);
    assert.equal(
      (
        await sales.context.request.post(
          origin + `/api/v1/crm/quotations/${quote.id}/send`,
          { data: {}, headers: { Origin: origin } },
        )
      ).status(),
      409,
    );
    assert.equal(
      (await db.quotation.findUniqueOrThrow({ where: { id: quote.id } }))
        .status,
      "DRAFT",
    );
    checks.push(
      "real HTTP module/branch/bulk authority denials; inquiry→assigned lead→follow-up→customer/package quotation preserves1000.50; unconfigured delivery staysDRAFT",
    );
    await page.goto(origin+`/admin/manage/customers?record=${quote.customerId}`);
    await page.getByRole("heading",{name:inquiryName,exact:true}).waitFor();
    await page.getByRole("heading",{name:"Related work & recorded activity",exact:true}).waitFor();
    await page.getByRole("link",{name:quote.quotationNumber,exact:true}).waitFor();
    checks.push("Converted customer business summary and related quotation open through the same scoped workspace");
    await page.goto(origin+"/admin/manage/quotations");await page.getByRole("cell",{name:quote.quotationNumber,exact:true}).waitFor();
    checks.push("Quotation list identifies records by quotation number, linked customer and accurate net amount");
    await restricted.page.goto(
      origin + `/admin/manage/leads?record=${lead.id}`,
    );
    await restricted.page
      .getByRole("heading", { name: inquiryName, exact: true })
      .waitFor();
    assert.equal(
      await restricted.page
        .getByRole("button", { name: "Edit record", exact: true })
        .count(),
      0,
    );
    assert.equal(
      (
        await restricted.context.request.patch(
          origin + `/api/v1/management/leads/${lead.id}`,
          {
            headers: { Origin: origin },
            data: {
              data: { fullName: "Denied change" },
              version: state.updatedAt.toISOString(),
            },
          },
        )
      ).status(),
      403,
    );
    await page.goto(origin + `/admin/leads/${lead.id}`);
    await page.waitForURL(`**/admin/manage/leads?record=${lead.id}`);
    await page
      .getByRole("heading", { name: inquiryName, exact: true })
      .waitFor();
    const filterName = "Browser filter " + tag.slice(0, 8);
    const batch = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        db.lead.create({
          data: {
            leadNumber: `SYN-LD-${tag.slice(0,5)}-${String(i).padStart(3,"0")}`,
            fullName: `${filterName} ${String(i).padStart(2, "0")}`,
            mobile: "+000",
            branchId: branch.id,
            status: "CONTACTED",
            assignedUserId: staff.id,
          },
        }),
      ),
    );
    await page.goto(
      origin + "/admin/leads?q=" + encodeURIComponent(filterName) + "&page=1",
    );
    await page.waitForURL("**/admin/manage/leads?**");
    await page
      .getByRole("heading", { name: "Inquiries & leads", exact: true })
      .waitFor();
    await page.getByLabel("Search records", { exact: true }).fill(filterName);
    await page.getByLabel("Status", { exact: true }).selectOption("CONTACTED");
    for (const [name, value] of [
      ["branchId", branch.id],
      ["assignedUserId", staff.id],
    ]) {
      await page
        .locator(`select[name="${name}"] option[value="${value}"]`)
        .waitFor({ state: "attached" });
      await page.locator(`select[name="${name}"]`).selectOption(value);
    }
    await page.getByLabel("Sort records", { exact: true }).selectOption("name");
    await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .click();
    await page.getByText(/25 records.*Page 1 of 2/).waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText(/25 records.*Page 2 of 2/).waitFor();
    const filteredUrl = page.url();
    await page.reload();
    await page.getByText(/25 records.*Page 2 of 2/).waitFor();
    await page
      .getByRole("button", { name: /Open record Browser filter/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Back to list", exact: true })
      .click();
    await page.getByText(/25 records.*Page 2 of 2/).waitFor();
    await page.waitForURL(filteredUrl);
    assert.equal(page.url(), filteredUrl);
    checks.push(
      "Read-only viewer cannot mutate; legacy lead URLs resolve to canonical actions; status/owner/branch/name filters and totals persist through pagination, reload and record-return",
    );
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(origin + "/admin");
    const menu = page.locator(
      'button[aria-controls="staff-primary-navigation"]',
    );
    await menu.click();
    assert.equal(await menu.getAttribute("aria-expanded"), "true");
    await menu.press("Escape");
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    assert.ok(await menu.evaluate((el) => el === document.activeElement));
    await menu.press("Enter");
    await page
      .getByRole("navigation", { name: "Staff workspace", exact: true })
      .getByRole("link", { name: "Inquiries & leads", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Inquiries & leads", exact: true })
      .waitFor();
    assert.equal(await menu.getAttribute("aria-expanded"), "false");
    const keyboardPage = await sales.context.newPage();
    await keyboardPage.goto(origin + "/admin");
    await keyboardPage.keyboard.press("Tab");
    assert.ok(
      await keyboardPage
        .getByRole("link", { name: "Skip to workspace content", exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await keyboardPage.keyboard.press("Enter");
    assert.ok(
      await keyboardPage
        .locator("#staff-content")
        .evaluate((el) => el === document.activeElement),
    );
    await keyboardPage.close();
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + `/admin/manage/leads?record=${lead.id}`);
      await page
        .getByRole("heading", { name: inquiryName, exact: true })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.ok(
        await page
          .locator("#staff-content")
          .evaluate((el) => el.getBoundingClientRect().right <= innerWidth + 1),
      );
      await page.screenshot({
        path: path.join(output, `admin-record-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 375, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const zoomGeometry=await page.evaluate(()=>({width:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth,overflow:[...document.querySelectorAll("#staff-content,aside,h1,h2,button,input,select,textarea,details,section,dd")].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).slice(0,20)}));
    fs.writeFileSync(path.join(output,"zoom-geometry.json"),JSON.stringify(zoomGeometry,null,2));
    await page.screenshot({
      path: path.join(output, "admin-record-text200.png"),
      fullPage: true,
    });
    await page.screenshot({path:path.join(output,"admin-text200-viewport.png"),fullPage:false});
    assert.equal(zoomGeometry.overflow.length,0,"200% text produces offscreen controls or sections");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    checks.push(
      "Mobile disclosure keyboard/Escape/focus and navigation closing; skip link focus;320/375/1440 record reflow and200%text scaling inspected",
    );
    if (process.env.ZAT_AXE_SCRIPT) {
      const inspections=[];
      for(const [route,ready] of [["/admin","dashboard"],["/admin/manage/leads?status=CONTACTED","list"],[`/admin/manage/leads?record=${lead.id}`,"record"],[`/admin/manage/customers?record=${quote.customerId}`,"record"]]) {
        await page.setViewportSize({width:1440,height:1000});await page.goto(origin+route);
        if(ready==="record") await page.getByRole("heading",{name:"Related work & recorded activity",exact:true}).waitFor();
        if(ready==="list") await page.getByText(/records.*Page/).waitFor();
        await page.addScriptTag({path:process.env.ZAT_AXE_SCRIPT});
        const result=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa"]}}));
        const violations=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}));
        inspections.push({route,violations});fs.writeFileSync(path.join(output,"crm-accessibility.json"),JSON.stringify(inspections,null,2));
        assert.equal(violations.length,0,`Accessibility findings on ${ready}`);
        await page.screenshot({path:path.join(output,`admin-accepted-${ready}-${inspections.length}.png`),fullPage:true});
      }
      checks.push("axe WCAG2.2 A/AA checks passed on dashboard, filtered lead list, lead and customer records");
    }
    const result = {
      status: "passed",
      syntheticOnly: true,
      checks,
      productionChanges: false,
      outboundProvidersActivated: false,
      financialJourney:
        "Existing synthetic receipt/accounting guards preserved; no production transactions",
    };
    fs.writeFileSync(
      path.join(output, "admin-browser-result.json"),
      JSON.stringify(result, null, 2),
    );
    completed = true;
    console.log(JSON.stringify(result));
  } finally {
    if (browser && !completed) {
      let index = 0;
      for (const context of browser.contexts())
        for (const page of context.pages()) {
          try {
            await page.screenshot({
              path: path.join(output, `failure-${index}.png`),
              fullPage: true,
            });
            fs.writeFileSync(
              path.join(output, `failure-${index}.txt`),
              await page.locator("body").innerText(),
            );
          } catch {}
          index++;
        }
    }
    if (browser) await browser.close();
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    if (log !== undefined) fs.closeSync(log);
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
