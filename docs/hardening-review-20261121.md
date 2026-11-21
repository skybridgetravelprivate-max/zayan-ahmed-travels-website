# Financial and reliability hardening review

Production baseline rechecked read-only in hPanel: PR #43, `88321c0e301054ec55d08a9cecb0674f714a0030`, deployment `01a1f4bc-5ee9-7344-9e2d-2c29fc9f7e3e`, Current / Completed. This branch is review-only. No merge, deployment, production migration, financial rewrite, upload activation or policy publication is authorized by this work.

## Dependency release gate

Full audits include development dependencies at moderate severity. Website passes. Backend reports one distinct advisory, GHSA-7589-6fvf-x4pw (Effect TemplateLiteral ReDoS), with three packages flagged: `prisma@6.19.3 → @prisma/config@6.19.3 → effect@3.21.0`. The parent config pins Effect exactly. Registry checks found no 6.19.4 config; the listed stable Prisma 7 configs through 7.10.1 also pin affected Effect versions (3.18.4/3.20.0). Effect 3.22.1 is patched, but its existence does not make it a supported replacement for an exact parent pin. Do not force npm's suggested downgrade to 6.12.0, use a release candidate, exclude dev dependencies or suppress the advisory. No dependency override or lockfile change is included. A supported parent resolution or separately evaluated compatible dependency change is required before release. No remote application exploit through this dependency was established.

## Prepared changes

Payroll enforces existing global/Super Admin authority, validates the period label, uses one transaction for run/slips/number sequence/audit, preserves Decimal salaries and uses a user-scoped durable request key. The same key/payload replays one run; changed payload conflicts. Different keys can represent separate runs for a period; no unapproved one-run-per-month business rule is added.

Service invoices, opening balances, STAR/transport totals and ticket refund/reissue arithmetic preserve Decimal values and validate scale/range/whole quantities. Ticket posting is restricted to the company currency and a unit rate until FX accounting is approved. This includes legacy ticket receipt/refund/reissue paths. Read-only production aggregate review found zero tickets and zero unsupported-currency/rate tickets; no historical records were changed. Existing read/PDF paths remain available and no conversion or gain/loss policy is invented.

Resource CSV exports read authorized/redacted pages up to 5000 rows, reject larger exports before sending, and reject detected row-count changes/duplicate IDs. This is a bounded export, not a database snapshot guarantee. Trial balance and profit/loss use one grouped query apiece. Daily sales filter/group in PostgreSQL rather than loading all source records into Node.

The additive migration `20261121090000_hardening_indexes_outbound` prepares recent-auth/customer-ticket indexes and a private RLS-enabled outbound submission table. The table stores request identity, content fingerprint, status and optional provider reference; no message body, destination, provider token or password is stored. It has no anon/authenticated grants. Apply only in isolation for this review; production application requires separate authorization. Review index creation locks against production size before deployment.

WhatsApp requests require a durable Idempotency-Key. Uncertainty is committed before the provider request. A timeout, crash or failed outcome write cannot automatically resend the same key or an identical uncertain payload. An authenticated caller can retrieve their saved submission status. Only Super Admin/settings authority may reconcile a confirmed outcome with an audited reason; a NOT_SENT resolution requires a new explicit submission key to retry. `SENT` means the existing generic transport returned a successful JSON response, not proof of recipient delivery. The generic optional JSON `id` is retained when present. Actual provider documentation, acceptance/delivery semantics and a controlled sandbox remain required; no webhook signature contract or provider reconciliation API has been invented. No real recipient is used by tests.

## Website and hosting preparation

The Next.js 16 proxy generates a fresh nonce, replaces browser-supplied nonce headers and prepares a stronger script policy in report-only mode. Existing enforced frame/base/object protection remains. JSON-LD receives the nonce. No external CSP report collector is configured and enforcement is not enabled. Package breadcrumbs use published names/references without inventing Offer prices.

`HSTS_ENABLED=true` is a separately reviewed opt-in, initially max-age=300, without includeSubDomains or preload. The combined gateway covers all routes; Nest and Next also support the flag independently. Production configuration was not changed. Inspect TLS and the Hostinger auto-deployment setting before and after any future release; Save and redeploy previously re-enabled auto-deployment.

No caching change is made before the synthetic cold/warm/CMS-outage measurements. Private/account cache behavior remains unchanged. Rendering timings are local observations, not production Core Web Vitals or an availability promise.

## Verification performed

Clean installs from both unchanged lockfiles completed. Website/backend lint, website no-emit typecheck, the combined production build (including Prisma generation/API typecheck and Hostinger packaging), packaging regression and git diff --check passed. Backend unit/security suite: 163 passed. Customer-auth15, customer-bookings15, staff13, inquiry3, presentation3, receipt-retry3 and CSP1 checks passed.

The new compiled Nest HTTP/PostgreSQL17 suite passes nine checks including scoped payroll403/no disclosure/no writes, late-slip rollback (including sequence/audit), concurrent payroll replay/mismatched payload, exact invoice lines/balanced posting, unsupported FX write denial, database daily aggregation and mocked WhatsApp uncertain-result/reconciliation. Representative 20,000-row EXPLAIN ANALYZE fixtures selected LoginAttempt_createdAt_idx and TicketSale_customerId_createdAt_idx without forcing planner settings. The additive migration applied only to disposable databases.

Both actual Chrome journeys passed against fresh disposable PostgreSQL17 databases and the production build. The full HTTP/SMTP journey retains privileged-route denial, Super Admin operations, customer recovery/session revocation, expiry/concurrent/reuse checks, receipt review/retry/reopen, branch/linked-owner isolation, Umrah holds, ticket/transport/visa forms and private PDFs. New checks verify report-only nonce/JSON-LD matching, opt-in HSTS, truthful published-package breadcrumbs and no customer page errors. Selected customer axe returned zero violations; incomplete/manual checks remain. The hotel journey retained owner/other login isolation, multi-room/guest transfer/check-in/out, exact receipt/AR, PDFs and mobile/desktop fit. External supplier settlement and real provider delivery are not claimed.

One local initial-process public request took 865ms, a warm request119ms, controlled CMS503 fallback64ms and restored CMS57ms; each returned200. These are single synthetic observations, not latency acceptance targets or a production load test. No cache behavior was changed. Hostinger was read only; no new deployment or production migration was attempted.

## Recovery, storage and owner decisions

Both retained archive hashes still match: production-schema ciphertext `7202AB5B0491D1BFB2FABEAFB7EBA89C068C64A1A37748A6A0C26B4428D3F71D`; synthetic financial/object ciphertext `E8D657BC95850AAA139B8A0BE6F85A568D14A2A298B66A9A1D5A7309268BE848`. Existing local restore evidence was reviewed; independent offsite retrieval/key custody is not established. The production snapshot excludes later writes and storage objects; the financial/object archive is synthetic.

Connected project discovery still exposes only production. Owner must identify an approved offsite artifact/private destination and independent key custodian/transfer method, and an approved isolated hosted storage project/access. No paid resource or key distribution is performed. Keep DOCUMENT_UPLOADS_ENABLED=false; hosted durability/recovery and separate activation approval remain required.

Policy owner-review drafts remain in the existing release outputs. Missing decisions remain: retention/deletion, processors/locations, booking acceptance, service-specific cancellation/refund rules, credit versus payout, complaints/jurisdiction and effective date. No unapproved public wording changes are included. Accountant decisions are also required for FX basis/rate timing/rounding, tax, settlement and supplementary payroll rules; provider documentation/sandbox is required for real messaging acceptance.
