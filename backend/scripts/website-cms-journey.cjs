"use strict";
// Opt-in: real browser + HTTP against a disposable local PG17 database only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { randomUUID, randomBytes } = require("node:crypto");
const { Prisma, PrismaClient } = require("../node_modules/@prisma/client");
const bcrypt = require("../node_modules/bcryptjs");
async function main() {
  const databaseUrl = process.env.ZAT_SYNTHETIC_DATABASE_URL;
  const u = new URL(databaseUrl);
  assert.equal(u.hostname, "127.0.0.1");
  assert.equal(u.port, "55463");
  assert.equal(u.pathname, "/zat_synthetic_fullstack_browser_20261028");
  const root = path.resolve(__dirname, "../..");
  const output = path.resolve(
    process.env.ZAT_SYNTHETIC_BROWSER_OUTPUT ||
      path.join(os.tmpdir(), "zat-cms-browser-evidence"),
  );
  fs.mkdirSync(output, { recursive: true });
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const children = [];
  const logs = [];
  let browser;
  const origin = "http://127.0.0.1:55321", apiOrigin = origin;
  const checks = [];
  try {
    const [v] =
      await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
    assert.ok(v.version >= 170000 && v.version < 180000);
    const existingHome = await db.cmsPage.findUnique({
      where: { slug: "home" },
    });
    if (existingHome)
      await db.cmsPage.update({
        where: { id: existingHome.id },
        data: {
          published: Prisma.DbNull,
          publishedVersion: null,
          status: "DRAFT",
        },
      });
    const password = `Synthetic-${randomBytes(18).toString("hex")}!`;
    const hash = await bcrypt.hash(password, 10);
    const tag = randomUUID();
    const role = await db.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: { name: "SUPER_ADMIN" },
    });
    const branch = await db.branch.create({
      data: { code: tag, name: "Synthetic browser branch" },
    });
    const admin = await db.user.create({
      data: {
        username: tag,
        email: `${tag}@example.test`,
        fullName: "Synthetic website reviewer",
        passwordHash: hash,
        defaultBranchId: branch.id,
        roles: { create: { roleId: role.id } },
      },
    });
    const permissions = await Promise.all(
      ["cms.view", "cms.edit"].map((code) =>
        db.permission.upsert({ where: { code }, update: {}, create: { code } }),
      ),
    );
    const editorRole = await db.role.create({
      data: {
        name: `Synthetic editor ${tag}`,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
    });
    const editor = await db.user.create({
      data: {
        username: `editor-${tag}`,
        email: `editor-${tag}@example.test`,
        fullName: "Synthetic draft editor",
        passwordHash: hash,
        roles: { create: { roleId: editorRole.id } },
      },
    });
    const env = {};
    for (const k of [
      "SystemRoot",
      "WINDIR",
      "TEMP",
      "TMP",
      "PATH",
      "USERPROFILE",
      "LOCALAPPDATA",
    ])
      if (process.env[k]) env[k] = process.env[k];
    Object.assign(env, {
      NODE_ENV: "production",
      START_MODE: "all",
      PORT: "55321",
      GATEWAY_HOST: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      JWT_SECRET: randomBytes(40).toString("hex"),
      JWT_REFRESH_SECRET: randomBytes(40).toString("hex"),
      CUSTOMER_BOOKINGS_INTERNAL_TOKEN: randomBytes(40).toString("hex"),
      APP_URL: origin,
      API_URL: apiOrigin,
      CRM_API_URL: apiOrigin,
      SITE_URL: origin,
      API_HOST: "127.0.0.1",
      API_PORT: "55322",
      COOKIE_SECURE: "false",
      DOCUMENT_UPLOADS_ENABLED: "false",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_PATH:
        process.env.ZAT_SYNTHETIC_MEDIA_ROOT ||
        path.join(output, "zat-synthetic-cms-browser-images"),
      NEXT_TELEMETRY_DISABLED: "1",
    });
    function launch(name, args, environment) {
      const log = fs.openSync(path.join(output, name + ".log"), "w");
      logs.push(log);
      const child = spawn(process.execPath, args, {
        cwd: root,
        env: environment,
        stdio: ["ignore", log, log],
        windowsHide: true,
      });
      children.push(child);
      return child;
    }
    const webChild = launch("cms-packaged-gateway", [path.join(root,".next/standalone/server.js")], env);
    const apiChild = webChild;
    async function ready(url, child) {
      const end = Date.now() + 60000;
      for (;;) {
        try {
          if ((await fetch(url)).status === 200) return;
        } catch {}
        assert.ok(
          child.exitCode === null && Date.now() < end,
          "Local server did not become ready",
        );
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    await ready(apiOrigin + "/api/health", apiChild);
    await ready(origin, webChild);
    const playwrightPath =
      process.env.ZAT_PLAYWRIGHT_MODULE ||
      path.join(
        os.tmpdir(),
        "zat-quote-pg17-validation/browser-tools/node_modules/playwright-core",
      );
    const { chromium } = require(playwrightPath);
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("heading", { level: 1, name: /Umrah made/ }).waitFor();
    await page.screenshot({
      path: path.join(output, "fullstack-home-desktop-2026-10-28.png"),
      fullPage: true,
    });
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `Overflow at ${width}`,
      );
      if (width === 375) {
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
        await page
          .getByRole("navigation", { name: "Menu", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .waitFor();
        await page.screenshot({
          path: path.join(output, "fullstack-home-mobile-2026-10-28.png"),
          fullPage: true,
        });
      }
    }
    checks.push(
      "actual desktop/tablet/mobile homepage, 375/768/1440 overflow checks, mobile menu and Escape",
    );
    for (const route of [
      "flights",
      "hotels",
      "umrah",
      "visa",
      "tours",
      "transport",
      "offers",
      "travel-guide",
      "about",
      "contact",
      "corporate",
      "group-booking",
      "account",
      "my-bookings",
      "support",
      "terms",
      "privacy",
      "refund-policy",
      "cancellation-policy",
      "payment-methods",
    ]) {
      const r = await context.request.get(origin + "/" + route);
      assert.equal(r.status(), 200, route);
    }
    for (const route of [
      "/flights/cedar-jed",
      "/hotels/noor-court",
      "/offers/umrah-14",
      "/visa/saudi",
    ]) {
      assert.equal(
        (await context.request.get(origin + route)).status(),
        404,
        route,
      );
    }
    checks.push(
      "20 public/account routes respond; fictional inventory detail URLs return 404",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(origin + "/admin/login");
    await page.getByLabel("Email or username").fill(admin.username);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Staff sign in", exact: true })
      .click();
    await page.waitForURL("**/admin");
    await page.goto(origin + "/admin/website");
    await page
      .getByRole("heading", { name: "Website management", exact: true })
      .waitFor();
    if (existingHome) {
      await page.getByRole("button", { name: /^home DRAFT/ }).waitFor();
      await page.getByRole("button", { name: "Homepage", exact: true }).click();
      await page
        .getByRole("heading", { name: "Editing home", exact: true })
        .waitFor();
    }
    checks.push(
      "real staff login form, cookie session and protected website-management route",
    );
    const anonymous = await browser.newContext();
    const denied = await anonymous.request.get(
      origin + "/api/v1/website/pages",
    );
    assert.equal(denied.status(), 401);
    assert.ok((denied.headers()["cache-control"] || "").includes("no-store"));
    assert.equal(
      (await anonymous.request.get(origin + "/admin/website/preview/home"))
        .url()
        .includes("/admin/login"),
      true,
    );
    const forged = await context.request.put(
      origin + "/api/v1/website/pages/home",
      {
        headers: { Origin: "https://untrusted.example.test" },
        data: { version: 0, content: {} },
      },
    );
    assert.equal(forged.status(), 403);
    assert.equal(
      (
        await context.request.post(origin + "/api/v1/cms-pages", {
          headers: { Origin: origin },
          data: {
            slug: "bypass",
            title: "No",
            body: "No",
            status: "PUBLISHED",
          },
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await context.request.post(origin + "/api/v1/admin/cms/pages", {
          headers: { Origin: origin },
          data: {
            slug: "bypass",
            title: "No",
            body: "No",
            status: "PUBLISHED",
          },
        })
      ).status(),
      403,
    );
    checks.push(
      "anonymous/private preview denial, forged-origin denial, generic and legacy publishing bypass denial",
    );
    await page
      .getByLabel("Page / SEO title", { exact: true })
      .fill("Synthetic draft: unpublished");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor();
    const publicPage = await anonymous.newPage();
    await publicPage.goto(origin);
    await publicPage
      .getByRole("heading", { level: 1, name: /Umrah made/ })
      .waitFor();
    assert.equal(
      (
        await anonymous.request.get(origin + "/api/public/website/pages/home")
      ).status(),
      404,
    );
    const preview = await context.newPage();
    await preview.goto(origin + "/admin/website/preview/home");
    await preview
      .getByRole("heading", { level: 1, name: "Synthetic draft: unpublished" })
      .waitFor();
    await page
      .getByRole("button", { name: "Submit for review", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Publish reviewed content", exact: true })
      .waitFor({ state: "visible" });
    page.on("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Publish reviewed content", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Page publish completed" })
      .waitFor();
    await publicPage.reload();
    {
      const publicState = await anonymous.request.get(
        origin + "/api/public/website/pages/home",
      );
      console.log(
        JSON.stringify({
          stage: "public-reload",
          status: publicState.status(),
          headings: await publicPage.locator("h1").allTextContents(),
        }),
      );
    }
    await publicPage
      .getByRole("heading", { level: 1, name: "Synthetic draft: unpublished" })
      .waitFor();
    checks.push(
      "actual CMS form: draft stays private, authenticated saved preview, explicit review/publish updates public page without deployment",
    );
    await page
      .getByLabel("Page / SEO title", { exact: true })
      .fill("Synthetic second private title");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Draft saved" }).waitFor();
    await publicPage.reload();
    {
      const publicState = await anonymous.request.get(
        origin + "/api/public/website/pages/home",
      );
      console.log(
        JSON.stringify({
          stage: "public-reload",
          status: publicState.status(),
          headings: await publicPage.locator("h1").allTextContents(),
        }),
      );
    }
    await publicPage
      .getByRole("heading", { level: 1, name: "Synthetic draft: unpublished" })
      .waitFor();
    const editorContext = await browser.newContext();
    const login = await editorContext.request.post(origin + "/api/auth/login", {
      headers: { Origin: origin },
      data: { identifier: editor.username, password },
    });
    assert.equal(login.status(), 201);
    const row = await db.cmsPage.findUniqueOrThrow({ where: { slug: "home" } });
    assert.equal(
      (
        await editorContext.request.post(
          origin + "/api/v1/website/pages/home/publish",
          { headers: { Origin: origin }, data: { version: row.version } },
        )
      ).status(),
      403,
    );
    assert.equal(
      (
        await context.request.put(origin + "/api/v1/website/pages/home", {
          headers: { Origin: origin },
          data: { version: 0, content: row.draft },
        })
      ).status(),
      409,
    );
    checks.push(
      "new draft preserves current published body, editor cannot publish, stale HTTP save rejects 409",
    );
    await page.screenshot({
      path: path.join(output, "fullstack-cms-editor-2026-10-28.png"),
      fullPage: false,
    });
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "Page unpublish completed" })
      .waitFor();
    await publicPage.reload();
    await publicPage
      .getByRole("heading", { level: 1, name: /Umrah made/ })
      .waitFor();
    const snapshot = await db.cmsPage.findUniqueOrThrow({
      where: { slug: "home" },
    });
    assert.equal(snapshot.status, "DRAFT");
    await publicPage.getByLabel("From", { exact: true }).fill("Islamabad");
    await publicPage.getByLabel("To", { exact: true }).fill("Jeddah");
    await publicPage
      .getByLabel("Departure", { exact: true })
      .fill("2026-11-10");
    await publicPage
      .getByRole("button", { name: "Prepare inquiry", exact: false })
      .click();
    await publicPage
      .getByLabel("Name", { exact: true })
      .fill("Synthetic preference tester");
    await publicPage.getByLabel("To", { exact: true }).fill("Madinah");
    await publicPage
      .getByRole("button", { name: "Prepare inquiry", exact: false })
      .click();
    assert.equal(
      await publicPage.getByLabel("Name", { exact: true }).inputValue(),
      "Synthetic preference tester",
    );
    const inquiryEmail = `inquiry-${tag}@example.test`;
    await publicPage.getByLabel("Email", { exact: true }).fill(inquiryEmail);
    await publicPage.getByLabel("Phone", { exact: true }).fill("03120000000");
    await publicPage
      .locator('textarea[name="message"]')
      .fill("Synthetic inquiry only. No booking or payment requested.");
    await publicPage
      .getByRole("button", { name: "Send travel inquiry", exact: true })
      .click();
    await publicPage
      .getByRole("status")
      .filter({ hasText: "Your message was received" })
      .waitFor();
    const lead = await db.lead.findFirstOrThrow({
      where: { email: inquiryEmail },
    });
    assert.ok(lead.notes.includes("Madinah"));
    assert.ok(!lead.notes.includes("Jeddah"));
    assert.equal(lead.source, "WEBSITE");
    checks.push(
      "actual inquiry panel preserves contact fields when preferences change and creates one CRM website lead with the latest itinerary; no message delivery or booking claimed",
    );
    if(process.env.ZAT_AXE_SCRIPT){
      const findings=[];
      const accessibilityPage=await anonymous.newPage();
      for(const route of ["/","/flights","/contact","/umrah"]){
        await accessibilityPage.goto(origin+route);
        await accessibilityPage.addScriptTag({path:process.env.ZAT_AXE_SCRIPT});
        const result=await accessibilityPage.evaluate(async()=>window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}));
        findings.push({route,violations:result.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,helpUrl:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}))});
      }
      fs.writeFileSync(path.join(output,"fullstack-accessibility-2026-10-28.json"),JSON.stringify(findings,null,2));
      assert.equal(findings.flatMap(f=>f.violations).length,0,"Accessibility violations require review");
      checks.push("axe WCAG A/AA checks passed on homepage, flights, contact and Umrah; keyboard/mobile checks passed separately");
    }
    const result = {
      status: "passed",
      syntheticOnly: true,
      database: "zat_synthetic_fullstack_browser_20261028",
      apiStorageMode: "packaged production gateway; uploads disabled",
      websiteMode: "packaged production build on Node "+process.versions.node,
      checks,
      productionChanges: false,
    };
    fs.writeFileSync(
      path.join(output, "fullstack-cms-browser-result-2026-10-28.json"),
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    if (browser) await browser.close();
    for (const child of children.reverse())
      if (child.exitCode === null) {
        child.kill();
        await new Promise((resolve) => child.once("exit", resolve));
      }
    for (const fd of logs) fs.closeSync(fd);
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.stack || "Synthetic website journey failed");
  process.exitCode = 1;
});
