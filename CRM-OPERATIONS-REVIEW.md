# CRM operations candidate — 29 October 2026

Local branch: `repair/crm-operations-20261029`, based on `d3445445c6ddf263cb958cd130b596ce0d2b50a9`. No schema migration, dependency update, production write, commit to release branch, push or deployment is included. Everything stayed free. No additional agents were used.

## Confirmed corrections

Thirteen defects were reproduced before correction in isolated PostgreSQL 17: global overdue statistics; missing customer-only daily work; daily/stats module permission leakage; child scope accepting one authorized owner despite another foreign owner; stale reminders after generic writes; follow-up scheduling corrupting lead sales status/earliest reminder; legacy assignment bypassing eligibility/clearing agency; bulk assignment/delete authority bypass; bulk audit failure leaving changes; partial generic bulk deletion; skipped quotation delivery marking SENT; related workspace module leakage; and cross-branch merge moving customer history.

The candidate reuses canonical resource/management scope, validation, audit and serializable transactions. A small shared helper maintains the earliest pending lead reminder under ordered locks. SQL serialization/deadlock conflicts and Prisma conflicts return409. Assignment preserves omitted agency, validates active eligible staff/agents and requires the current record version. Notifications are transactional. Merge is same-branch and atomic with audit.

The staff dashboard now exposes real scoped due work/open sales with honest unavailable/forbidden/empty states and configured company calendar day. Existing management forms gain lead-context follow-up/task links. Public inquiries remain unrouted until an administrator explicitly chooses a branch; automatic HO routing is not an approved business rule. Customer workspace outstanding is explicitly Umrah-only and absent without booking permission; it is not a cross-module ledger balance.

## Proof

- New CRM PG17 suite:19 tests including its parent, with concurrent assignment/reminders, permission checks and mutation/audit rollback.
- Existing finance PG17 suite:20 tests including parents; quotation/booking/recovery guards retained.
- Backend142; staff11; customer bookings15; customer auth9; inquiries2; receipt retry3. Counts describe runner-reported tests and include parent tests where reported, not independent business cases.
- API build/typecheck; website production build and Hostinger standalone packaging passed.
- Backend lint clean. Website lint0errors and2pre-existing StaffSessionForm navigation warnings.
- Both npm dependency audits reported0 vulnerabilities at the time of execution; lockfiles unchanged.
- Real installed Chrome against the packaged gateway: public inquiry→admin branch triage→staff assignment→contextual follow-up→queue→completion→customer/package quote; foreign/module denials; unconfigured delivery remains DRAFT. Screenshots375/768/1440 reviewed; no page overflow; axe WCAG A/AA0violations on dashboard.
- Fresh real-cookie HTTP/proxy journey: quotation1010.00, repeated conversion one undated booking, receipt250.25 retried once, balance/AR759.75, balanced journals, customer ownership/isolation and voucher downloads both price modes. Financial reload recovery is simulated persisted storage in this run; unchanged historical actual-tab/browser-closure evidence is reused.

Reproducible commands (Node22; clean OS-only environment plus disposable local URLs; never production credentials):

```text
npm run build --prefix backend
npm test --prefix backend
npm run test:staff
npm run lint --prefix backend
npm run lint
npm run build:website
npm run test:crm:pg17 --prefix backend
npm run test:customer-bookings
npm run test:customer-auth
npm run test:inquiries
npm run test:receipt-retry
backend/node_modules/.bin/tsx --tsconfig backend/apps/api/tsconfig.json --test --test-concurrency=1 backend/apps/api/src/crm/lead-quotation.pg17.spec.ts backend/apps/api/src/crm/quotation-journey.pg17.spec.ts backend/apps/api/src/finance/receipt-recovery.pg17.spec.ts
npm audit --audit-level=moderate --json
npm audit --prefix backend --audit-level=moderate --json
node backend/scripts/crm-operations-journey.cjs
node --import <file-URL-of-backend/tsx/loader.mjs> backend/scripts/quotation-http-journey.cjs
```

Browser harness requires a separate `zat_synthetic_crm_browser_*` database with existing14migrations, `ZAT_SYNTHETIC_DATABASE_URL`, `ZAT_SYNTHETIC_BROWSER_OUTPUT`, installed Playwright path and optional axe script. It creates only synthetic fixture users and does not activate uploads/providers. HTTP harness uses its own separate `zat_synthetic_*` database. Exact commands/log references are in the workspace outputs checks JSON.

Intermediate failures retained transparently: original regressions failed before repairs; lint caught effect-based state initialization, fixed by deriving initial state; build caught missing contextual row version, fixed with version:null. Actual concurrent SQL lock failure used P2010, so conflict mapping now covers SQLSTATE40001/40P01. Browser harness setup initially used incorrect schema path and default per-user Chrome location; corrected to existing schema/system Chrome. Browser passed; runner printing Unicode failed afterward, independently of saved passed JSON. HTTP loader initially used a Windows path instead of file URL; corrected, then journey passed. None of these was fixed by reducing authorization assertions.

## Remaining acceptance and compatibility

This is a focused CRM candidate, not whole-platform completion. Full Umrah/STAR/hotel check-in/out, transport dispatch, visa requirements, supplier settlement, refund payout, multipage/non-PKR documents, period close and comprehensive role/assistive-technology acceptance remain partial/unverified. Financially posted Umrah cancellation stays held for accounting review. Credits are not payouts. Production uploads remain disabled. SMTP/WhatsApp/GDS/Nusuk and other providers remain inactive. Outbound accepted-provider retry/outbox semantics are not established by skipped-channel tests.

Legacy CRM assignment callers must now provide record version; bulk actions require their actual assign/delete permissions; task/follow-up delegates enforce module create/edit permissions. Related workspace arrays omit forbidden records. Client owners must verify compatibility before release. Existing primary management UI supplies versions and passed actual browser acceptance. CI change is unpublished, so hosted execution is unverified.

## Future release and recovery gate

No push/deploy authorization exists for this candidate. Before proposing an exact commit: freshly verify release HEAD/deployed identity/live database binding, reconcile newer work, confirm external caller compatibility, and retain a recoverable exact current application artifact with checksums. Refresh recovery evidence only with separate approval: current snapshot predates migration14, lacks fresh offsite/full-project/object recovery, and does not prove full Linux rollback. Do not export or restore production under this local task.

A future code-only release needs exact commit push/automatic Hostinger deployment approval after those checks. No production migration is required for this candidate. Storage/provider activation, production business/permission/credential changes and backup upload/scheduling/retention remain separate approvals.

Deployment smoke plan: exact commit Completed/Current, health/database binding, HTTPS redirects, proxy path forwarding, private/no-store authenticated responses, anonymous401/foreign404, staff dashboard and assignment versions. Exercise financial writes only in synthetic staging. Retain existing receipt idempotency/review/maintenance protections throughout.

Rollback: stop new financial writes using existing approved maintenance controls only if authorized; inspect uncertain requests before reopening. Revert code via retained exact compatible application artifact while preserving all current data/schema and payment guards. Never restore a database snapshot to undo this code-only release. If legacy callers cannot safely use versions/new module checks, hold release and correct callers rather than disabling safeguards. Rollback to d344544 would reintroduce repaired CRM defects; assess access exposure and restrict affected routes until a corrected release. Verify health/private cache/receipt guards and reopen writes only after verification under explicit release authorization.

Workspace evidence directory: `C:/Users/HP/Documents/Codex/2026-10-20/referenced-chatgpt-conversation-this-is-an-2/outputs`. See `crm-operations-release-review-2026-10-29.md`, `crm-capability-acceptance-matrix-2026-10-29.md`, `crm-operations-checks-2026-10-29.json`, browser/finance result JSON, file inventory and candidate manifest. Candidate archive contains source only; no environments, secrets, customer records, browser profiles, dependencies or backups.
