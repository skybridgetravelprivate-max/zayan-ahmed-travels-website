"use strict";
const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");

module.exports = async function ({
  page,
  context,
  origin,
  db,
  admin,
  outsider,
  password,
  outputDir,
}) {
  const key = randomUUID();
  const id = (channel) =>
    `${channel}:${createHash("sha256")
      .update(JSON.stringify([admin.id, key]))
      .digest("hex")}`;
  const pending = await db.outboundMessage.create({
    data: {
      id: id("email"),
      channel: "EMAIL",
      userId: admin.id,
      fingerprint: randomUUID(),
      status: "UNCERTAIN",
    },
  });
  const before = await db.outboundMessage.count();
  const pageResponse = await page.goto(origin + "/admin/communications");
  assert.match(pageResponse.headers()["cache-control"], /private/);
  assert.match(pageResponse.headers()["cache-control"], /no-store/);
  await page
    .getByRole("heading", { name: "Communication recovery", exact: true })
    .waitFor();
  await page
    .getByLabel("Submission identity", { exact: true })
    .fill(pending.id);
  await page
    .getByRole("button", { name: "Read submission for review", exact: true })
    .click();
  await page
    .getByText("Current outcome: Uncertain — do not resend", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save audited outcome", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByLabel("Independently confirmed outcome", { exact: true })
    .selectOption("SENT");
  await page
    .getByLabel("Review reason and evidence", { exact: true })
    .fill("Synthetic independent capture confirms acceptance");
  await page
    .getByLabel(
      "I independently verified this outcome. A timeout was not my only evidence.",
      { exact: true },
    )
    .check();
  const reconcile = /\/api\/v1\/comms\/email\/[^/]+\/reconcile$/;
  let observedCommit;
  const committed = new Promise(resolve => { observedCommit = resolve; });
  await page.route(
    reconcile,
    async (route) => {
      const response = await route.fetch();
      fs.writeFileSync(path.join(outputDir, "communication-review-response.json"), JSON.stringify({ status: response.status(), body: (await response.text()).slice(0, 1000) }));
      assert.equal(response.status(), 201);
      observedCommit();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save audited outcome", exact: true })
    .click();
  await committed;
  await page.getByRole("alert").waitFor();
  assert.equal(
    (await db.outboundMessage.findUniqueOrThrow({ where: { id: pending.id } }))
      .status,
    "SENT",
  );
  await page
    .getByRole("button", { name: "Read submission for review", exact: true })
    .click();
  await page
    .getByText("Current outcome: Accepted by transport", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Save audited outcome", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await db.auditLog.count({
      where: { entityId: pending.id, action: "RECONCILE_EMAIL" },
    }),
    1,
  );
  assert.equal(await db.outboundMessage.count(), before);

  // Partial acceptance must retain the saved browser key, not resend the accepted channel.
  await db.outboundMessage.create({
    data: {
      id: id("whatsapp"),
      channel: "WHATSAPP",
      userId: admin.id,
      fingerprint: randomUUID(),
      status: "NOT_SENT",
    },
  });
  const recordId = randomUUID(),
    storageName = `zat:pending-receipt:${admin.username}:quotation-send:${recordId}`;
  await page.evaluate(
    ({ storageName, key }) =>
      localStorage.setItem(
        storageName,
        JSON.stringify({ key, fingerprint: "synthetic" }),
      ),
    { storageName, key },
  );
  await page
    .getByRole("button", { name: "Load saved quotation attempts", exact: true })
    .click();
  await page
    .getByLabel("Saved quotation attempt", { exact: true })
    .selectOption(`${admin.username}:quotation-send:${recordId}`);
  await page
    .getByRole("button", { name: "Check my submission", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Email: Accepted by transport", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", {
        name: "Prepare new quotation submission",
        exact: true,
      })
      .isDisabled(),
    true,
  );
  assert.ok(
    (
      await page.evaluate((name) => localStorage.getItem(name), storageName)
    ).includes(key),
  );

  const rejectedKey = randomUUID(),
    rejectedId = `email:${createHash("sha256")
      .update(JSON.stringify([admin.id, rejectedKey]))
      .digest("hex")}`;
  await db.outboundMessage.create({
    data: {
      id: rejectedId,
      channel: "EMAIL",
      userId: admin.id,
      fingerprint: randomUUID(),
      status: "NOT_SENT",
    },
  });
  const rejectedRecord = randomUUID(),
    rejectedName = `zat:pending-receipt:${admin.username}:quotation-send:${rejectedRecord}`;
  await page.evaluate(
    ({ name, key }) =>
      localStorage.setItem(
        name,
        JSON.stringify({ key, fingerprint: "synthetic-rejected" }),
      ),
    { name: rejectedName, key: rejectedKey },
  );
  await page
    .getByRole("button", { name: "Load saved quotation attempts", exact: true })
    .click();
  await page
    .getByLabel("Saved quotation attempt", { exact: true })
    .selectOption(`${admin.username}:quotation-send:${rejectedRecord}`);
  await page
    .getByRole("button", { name: "Check my submission", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Email: Confirmed not accepted",
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel(
      "I reviewed confirmed non-acceptance and want to prepare a new submission.",
      { exact: true },
    )
    .check();
  const savedRows = await db.outboundMessage.count();
  await page
    .getByRole("button", {
      name: "Prepare new quotation submission",
      exact: true,
    })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "No message was sent" })
    .waitFor();
  assert.equal(
    await page.evaluate((name) => localStorage.getItem(name), rejectedName),
    null,
  );
  assert.ok(
    await page.evaluate((name) => localStorage.getItem(name), storageName),
  );
  assert.equal(await db.outboundMessage.count(), savedRows);
  assert.equal(
    (await db.outboundMessage.findUniqueOrThrow({ where: { id: rejectedId } }))
      .status,
    "NOT_SENT",
  );

  const other = await context.browser().newContext();
  try {
    const outsiderPage = await other.newPage();
    await outsiderPage.goto(origin + "/admin/login/staff");
    await outsiderPage
      .getByLabel("Email or username", { exact: true })
      .fill(outsider.username);
    await outsiderPage.getByLabel("Password", { exact: true }).fill(password);
    await outsiderPage
      .getByRole("button", { name: "Staff sign in", exact: true })
      .click();
    await outsiderPage.waitForURL(origin + "/admin");
    await outsiderPage.goto(origin + "/admin/communications");
    await outsiderPage
      .getByRole("heading", { name: "My submission status", exact: true })
      .waitFor();
    assert.equal(
      await outsiderPage
        .getByRole("heading", {
          name: "Super Admin outcome review",
          exact: true,
        })
        .count(),
      0,
    );
    const denied = await other.request.get(
      origin + "/api/v1/comms/submissions/" + encodeURIComponent(pending.id),
    );
    assert.equal(denied.status(), 403);
    assert.doesNotMatch(await denied.text(), /fingerprint|providerReference/);
    await outsiderPage
      .getByLabel("Original submission key", { exact: true })
      .fill(key);
    await outsiderPage
      .getByRole("button", { name: "Check my submission", exact: true })
      .click();
    await outsiderPage
      .getByRole("heading", { name: "Email: No submission found", exact: true })
      .waitFor();
  } finally {
    await other.close();
  }
  const guest = await context.browser().newContext();
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(origin + "/admin/communications");
    await guestPage.waitForURL(/\/admin\/login/);
    assert.equal(
      await guestPage
        .getByRole("heading", {
          name: "Super Admin outcome review",
          exact: true,
        })
        .count(),
      0,
    );
  } finally {
    await guest.close();
  }
  await page.setViewportSize({ width: 375, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: path.join(outputDir, "communication-recovery-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(outputDir, "communication-recovery-desktop.png"),
    fullPage: true,
  });
  const axe =
    process.env.ZAT_AXE_SCRIPT ||
    path.resolve(process.env.ZAT_PLAYWRIGHT_MODULE, "../axe-core/axe.min.js");
  if (fs.existsSync(axe)) {
    await page.addScriptTag({ path: axe });
    const audit = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return {
        violations: result.violations.map((item) => ({
          id: item.id,
          targets: item.nodes.map((node) => node.target),
        })),
        incomplete: result.incomplete.map((item) => item.id),
      };
    });
    fs.writeFileSync(
      path.join(outputDir, "communication-recovery-accessibility.json"),
      JSON.stringify(audit, null, 2),
    );
    assert.deepEqual(audit.violations, []);
  }
  return "Communication recovery: Super Admin review with lost response/readback and one audit; scoped metadata denial/own-key isolation; partial acceptance retains key; confirmed non-acceptance releases only its saved key without sending; mobile375 fits";
};
