# Quotation journey validation — 2026-10-23

## Checkout review follow-up — 2026-10-24

Confirmed a remaining direct-booking fallback gap: `bookingFromLead` created a
quotation with the lead budget as its total but no quotation items. Added the
same single package line used by `quoteFromLead`, quantity 1 at the whole-package
budget, within the existing transaction. Existing quotations are not rewritten.

A new isolated PG17 regression failed before the fix (`0` items instead of `1`)
and passed afterward. The focused lead-quotation file reports **2 passed, 0
failed, 0 skipped**, covering both quotation entry paths, three adults with a
120000.03 package total, consistent item totals, repeat conversion without extra
booking/lines, and balanced posting. API `tsc --noEmit` and CRLF-aware diff checks
passed. Prior browser, receipt, document and full-build results were reused.

## Package-budget meaning

`quoteFromLead` and the direct `bookingFromLead` fallback both assign the lead budget once to the quotation total. It represents the whole package. The initial package line must therefore use quantity 1; adult count is not a multiplier for this total. The existing fix and its regression test were preserved.

The synthetic example starts with three adults and a package budget of 120000.03. Two extras add 0.30. Discount 100.03 and tax 50.00 produce net 119950.30. Receipts totaling 10003.10 leave booking balance and ledger receivables both at 109947.20.

## Changes

- Customer conversion, quotation creation, numbering and lead status now commit or roll back together.
- Quotation line changes, totals and audited edits use one transaction and a quotation row lock. Decimal arithmetic preserves monetary totals. Invalid amounts and negative net totals are rejected.
- Converted quotations cannot be financially edited, have lines added/removed, or be reopened through the quotation status endpoint. Conversion uses the same row lock.
- Conversion carries the lead's package and travel dates into the booking, allowing dated bookings to appear in the customer account list.
- The booking action for customers without a lead reuses quotation conversion, preventing duplicate bookings and missing sale/cost journals.
- Receipts lock the booking before updating its balance, reject overpayment/cancelled bookings, and retain later workflow steps. Optional `Idempotency-Key` values identify a submission through the existing receipt primary key, scoped to the staff user. Transaction-scoped advisory locks serialize keyed retries; matching retries return the existing receipt and conflicting payloads return 409. No schema migration is required.
- The staff receipt form supplies a retry key and prevents overlapping submissions. The key is reused for the same payload while that form remains open.
- Quotation and booking/voucher PDFs show subtotal/selling amount, discount, tax and net. Financial values use two decimal places. Price-excluded documents omit these amounts.

## Exact final results

| Check | Result |
| --- | --- |
| `npm run test:quotation:pg17 --prefix backend` | 14 passed, 0 failed, 0 skipped (includes the journey parent test) |
| `npm run test:account:pg17` | 1 passed, 0 failed, 0 skipped |
| `npm test --prefix backend` | 136 passed, 0 failed, 0 skipped |
| `npm run test:customer-auth` | 9 passed |
| `npm run test:customer-bookings` | 13 passed |
| `npm run test:staff` | 7 passed |
| API workspace build (`npm run build --prefix backend -w @zat/api`) | Passed |
| Website build (`next build --webpack`) | Passed, Next.js 16.3.8 |
| Website lint (`npm run lint`) | Passed; 0 errors, 2 existing navigation warnings in `StaffSessionForm.tsx` |
| `git diff --check` | Passed |
| PDF generation, PDF.js rendering and visual inspection | Six single-page PDFs passed: quotation, receipt and voucher, each with prices included/excluded |

PG17 cases cover concurrent/repeated customer and booking conversion, simultaneous quotation edits, decimal totals, failed audit/sequence/accounting rollback, immutable converted quotations, keyed duplicate/conflicting receipts, simultaneous distinct payments, overpayment, customer mismatch and foreign branch denial. Every journal in the completed payment journey balances, and the receivables ledger equals the booking balance.

The account test uses actual PostgreSQL website customer/session rows and verification audits. Unverified or altered CRM links are denied; the verified account sees only its own allowlisted booking; revoked sessions return no identity and receive 401. No financial fields are returned in booking-list DTOs.

The earlier behavior failed synthetic checks for invalid edits, creation rollback, converted edits, receipt concurrency and missing travel dates/account visibility. Some downstream baseline failures were consequences of earlier failures, not independent defects.

## Isolation and reproduction

All database work used a temporary PostgreSQL 17 cluster bound to loopback, port 55463, and database `zat_synthetic_quote`. Only synthetic fixtures were created. The cluster was stopped after validation. Builds ran in a temporary source copy using installed local dependencies; no application environment files were copied. Free PDF.js/canvas tools were installed only under Temp.

For the opt-in PG17 scripts, set `ZAT_SYNTHETIC_DATABASE_URL` to a fresh disposable PostgreSQL 17 database on loopback whose name begins `zat_synthetic_`. Initialize it with the repository Prisma schema. The scripts reject other host/database naming and server major versions. The fixtures remain in that disposable database. `ZAT_SYNTHETIC_PDF_DIR` optionally captures test PDFs.

## Remaining limits

- Integration tests invoke real services, controllers and selected guards, plus the website session/account resolver. A complete browser/HTTP journey, actual login cookies and delivery through the production reverse proxy were not exercised.
- SMTP/WhatsApp delivery, multipage document layouts and non-PKR conversion were not validated.
- Receipt retries without an idempotency key are separate payments. The form's retry key does not survive a page reload. Explicitly creating another quotation still creates another draft; customer and quotation-to-booking conversions are idempotent.
- Bookings without a departure date remain excluded by the existing account DTO contract until staff supplies a date. Staff ownership verification remains required before linking a website account to a CRM customer.
- Existing production quotations and historical discrepancies were not rewritten. No production data, production migration, push, deployment or additional agent was involved.

## Follow-up: reload retries, undated bookings and real HTTP journey

This follow-up supersedes the reload-key and undated-booking limitations above. Earlier completed accounting, rollback and document-layout validation was reused; the full audit was not repeated.

Receipt submissions now save only a SHA-256 payload fingerprint and the idempotency key in staff-scoped session storage **before** sending the payment. Reloading or reopening the receipt form preserves an uncertain submission's key. Different details are blocked until the operator retries the original details or explicitly acknowledges reviewing receipt history before starting another payment. Storage failures block submission. The key is cleared only after a confirmed response or that explicit review action. Receipt fields and authentication credentials are not stored there.

The booking DTO now represents an unknown travel date as explicit `null`. Undated bookings are retained by the CRM projection, BFF sanitizer and account parser, and the list displays **Date to be confirmed**. Missing/malformed date fields remain invalid, and the field allowlist and session/verified-link authorization are unchanged.

Targeted results:

| Check | Result |
| --- | --- |
| `npm run test:receipt-retry` | 3 passed: reload persistence, changed-payload/staff isolation, storage corruption/failure |
| `npm run test:customer-bookings` | 15 passed, including explicit null versus missing dates |
| Backend website booking DTO test | 1 passed |
| API build | Passed |
| Website build (`next build --webpack`) | Passed against final source |
| ESLint on changed retry/account files | 0 errors, 0 warnings |
| `git diff --check` | Passed |
| `backend/scripts/quotation-http-journey.cjs` | Passed against real Next/Nest handlers, real login cookies, guards and gateway route classification on loopback with synthetic PG17 data |

The HTTP journey created and edited a quotation, converted it twice to one undated booking, posted a receipt, simulated losing its response, recreated the client with persisted storage, and replayed the same key. Exactly one receipt remained. Net **1010.00**, paid **250.25**, balance and ledger receivables **759.75**; all journals balanced. A changed replay returned 409, unauthorized finance returned 403, and foreign-branch quotation/document requests returned 404. Both voucher price modes returned PDF bytes with private/no-store headers.

Actual customer registration/login cookies and staff ownership verification were exercised over HTTP. Before verification the customer received 403; after verification the owner received its undated booking with a null date. A forged customer query selector was ignored. Other/unverified accounts, anonymous requests, missing internal-token requests and customer-cookie access to staff vouchers were denied with the expected 401/403 responses. The harness uses the existing gateway path classifier and real application handlers; it does not mock authentication or accounting.

Run the opt-in HTTP harness in a **built temporary project copy** with `ZAT_SYNTHETIC_DATABASE_URL` pointing at the disposable PG17 database. This run used Node 24.19.0, existing local dependencies, and the prior synthetic cluster. `ZAT_SYNTHETIC_HTTP_OUTPUT` optionally selects a temporary log/result/PDF directory. No credentials are printed in the result. Test HTTP servers and the PG17 cluster were stopped afterward.

Remaining release checks: the reload was simulated by reconstructing the client from persisted session storage, not by driving a browser tab. A deployed proxy/browser smoke test remains unperformed. Session storage survives reloads in the same tab, not tab closure or separate tabs; external receipt callers must supply and reuse an idempotency key. Existing SMTP/WhatsApp, multipage and non-PKR limits remain. No production writes, production migrations, additional agents, push or deployment occurred.

## Release follow-up — 2026-10-24

`RELEASE-REVIEW.md` records the final receipt protocol, targeted results, release diff and rollback steps. It supersedes the prior same-tab/session-storage and simulated-browser limitations above.

Receipt keys are now mandatory. A server-side customer/branch lock plus durable explicit receipt-review audit prevents a fresh key or another staff user from bypassing an unreviewed keyed payment. Browser keys use shared local storage and Web Locks, survive tab/browser closure, and are retained until explicit saved-receipt review. No schema migration or historical financial rewrite is involved.

Actual Chrome tests against isolated PG17 and a real loopback reverse proxy passed: two tabs, a deliberately lost committed response, page reload, full browser closure/reopen, receipt review, undated booking display, staff PDF links, customer/foreign-staff document denial, real login cookies and customer isolation. Production proxy/TLS/cookie deployment checks remain pending. Earlier completed broad validation was reused; only targeted tests/builds were run for this follow-up.
