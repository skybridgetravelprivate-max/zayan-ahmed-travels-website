# Accounting workspace rebuild

Owner request: reproduce the observed Assan Accounts accounting/travel workflows
inside the existing Zayan Ahmed Travels CRM, removing unrelated CRM modules.
Private reference source code and database schema are unavailable. This is an
independent implementation from observed UI behavior, not a source-code copy.

## Measured reference

- Inter, 14px body, #495057 text, #f5f7fa canvas.
- 70px white top bar, 260px white sidebar, compact 4px cards/controls.
- Green sidebar identity panel, accounting and service-voucher navigation.
- Separate customer/supplier buying, selling and receipt concepts.
- Group-seat inventory is distinct from grouping passenger tickets by PNR.

## Current implementation

- Shared accounting shell, measured font/spacing and responsive navigation.
- Explicit accounting-module profile reused by sidebar, catalogue and dashboard.
- Retired leads/tasks/follow-ups, HR/payroll, CMS and other unrelated modules from
  the active accounting catalogue. Removed the unused lead queue component.
- Permission metadata is preserved; the profile cannot grant new permissions.
- Financial dashboard uses the existing Super Admin-only posted-ledger summary,
  with exact decimal strings and explicit failure states. No sample money values.
- Daily operations use the company calendar and per-service permissions/branch
  scope; check-in/check-out, issued ticket departures and transport bookings are
  counted from actual service dates. A flight counter counts ticket records,
  not distinct aircraft movements.
- Single-ticket entry now separates supplier buying and customer final selling
  totals using the existing transactional backend contract. Fare/tax components,
  cabin, baggage and final arrival are available. The explicit selling-total
  path has a ledger/profit regression. This is not the multi-ticket editor yet.
- Profile green and input borders are stronger than the sampled reference to
  retain readable text and control contrast.
- Existing transaction services, historical ticket records, role/branch guards,
  password recovery and public/customer website dependencies are retained.

## Remaining reference parity work

This foundation does NOT mean feature or visual parity is complete.

1. Full multi-passenger voucher editor with per-row customer/supplier, PNR,
   flight segments and approved detailed charges/commission calculations.
2. Unified journal/cash/bank voucher entry, backed by protected existing finance.
3. Quantity-based quick invoices and customer date-range consolidated documents.
4. Package editor combining visa, flight, hotel and transport components.
5. Consultant, airline/GDS, collection-ageing and upcoming-service report screens.
6. Reference-style hotel, visa, transport and group-seat editors.
7. Reference layout comparison at desktop/mobile and keyboard/contrast acceptance.
8. Replace remaining legacy-module dependency paths before physically deleting
   backend/schema code. Public inquiries still use leads; linked relations and
   financial constraints must be migrated deliberately rather than dropped.

The foundation shipped through PR49 as 8a49a822. Hostinger deployment
01a21895-42cb-709b-854f-9f305650e906 was verified Completed/Current.
No production deletion or migration was performed. Owner says old data is disposable and no new backup is required;
there is no reason to erase data merely to restyle and replace the workspace.
Old source data is not proof of customer selling prices or receipts.

Reference calculations, write correctness and backend authorization were not
validated by the read-only reference inspection. Do not copy visible financial
behavior without explicit formula/reconciliation tests.

## Executed foundation verification — 26 November 2026

- Website and backend full audits at moderate threshold: zero vulnerabilities.
- Website/backend lint, website typecheck, production website build and
  standalone packaging check passed. Backend build/typecheck passed.
- All 172 backend tests and 17 staff tests passed.
- Disposable PostgreSQL 17: 17 selected operations, ticket issuance, replacement,
  refund and historical-source checks passed. The HTTP/SMTP journey passed,
  including global authorization, branch denial, receipt retry and recovery.
- Synthetic browser: daily counters and actual ledger balances loaded; ticket
  buying/selling/receivings sections opened; historical 34 groups/51 rows remained
  accessible. No forms were submitted in this browser check.
- Desktop 260px sidebar/14px Inter checked. At 390px mobile width the navigation
  opened and the ticket page had no document horizontal overflow. A reproduced
  desktop overflow from screen-reader labels inside the scrolling records table
  was corrected by positioning their container; desktop recheck passed.
- PR49 and merge CI both passed. Production homepage, health (database healthy),
  both recovery pages and anonymous denial on operations/audit/manual-journal
  passed. Auto-deployment was restored off after publishing. Authenticated
  production form acceptance was not executed in that release.

## Next module parity increment — not deployed

- Remove the duplicate agency masthead from all management forms; retain the
  shared company header and branding on generated documents.
- Add a Super Admin-only reports workspace using the existing guarded catalogue,
  date filters, 50-row pagination and CSV exporter. No financial formulas or
  report posting behavior are changed. Current receivables explicitly omit date
  filtering. Displayed scalar values retain their original decimal strings.
- This is not the full reference reports suite. Account ledger, balance sheet,
  consultant/GDS/BSP analysis, PDF/print and additional service editors still
  require their own implemented and verified behavior.
- Executed local checks: website lint/typecheck, 17 staff tests, production build
  and standalone packaging passed. Synthetic browser trial balance and current
  receivables rendered, and downloaded CSV preserved the exact `70.26` value.
  A scoped staff user with `report.view` could sign in through the staff portal
  but could not see the report navigation or directly open global report data.
  Trial balance's unused start filter was subsequently removed and its cutoff
  explicitly labeled UTC midnight; lint/typecheck passed after that correction.
  Reports-only commit b191580 passed remote CI. The final filter browser recheck
  passed after the voucher increment: trial balance has no unused From input
  and its cutoff is explicitly labeled UTC midnight.

### Journal voucher increment — not deployed

- Multi-line journal editor with account/party search, exact debit/credit totals,
  balance validation, review confirmation and an explicit fresh-voucher action.
- Posting and recovery routes retain the controller's global finance guard.
  A per-operator persisted retry key, transaction lock, deterministic journal ID
  and request fingerprint prevent duplicate concurrent/reloaded submissions.
  Changed payloads or missing replay proof fail closed instead of posting again.
- Uses the existing posting account validation, PKR basis and journal transaction.
  Customer branch/linked-lead scope is checked; AR/AP lines require matching
  parties. Receipt settlement/review remains a separate existing workflow.
- No schema migration, supplier transfer, production journal or booking changes.
- Executed: 174 backend tests, 17 staff tests, lint/typechecks, production build,
  18 selected PostgreSQL 17 checks and the full HTTP/SMTP journey passed. HTTP
  also proves a branch admin with account.post is denied voucher submission and
  recovery. A browser posted one synthetic 100.25/100.25 journal, rejected an
  imbalance, reset the form and added/removed a row; database proof found one
  posted journal with a 0.00 difference. The fresh-voucher action was checked
  after its final correction. No production financial write was executed.
- This is a journal voucher, not full parity for cash/bank/expense vouchers,
  multi-ticket invoices or combined packages. Those remain separate work.

### General / quantity invoice increment

- A general/quick service invoice editor now captures a billing customer, branch,
  supplier, quantities, unit buying/selling rates, tax and discount amounts.
  Exact existing invoice calculations post the customer sale and supplier cost
  atomically. Saved request identities prevent duplicate retries/concurrent posts.
- Additive migration `20261127123000_service_invoice_supplier_cost` adds nullable
  invoice supplier, historical unit-cost snapshot and receipt allocation fields,
  indexed foreign keys and restricted deletion. Historical unknown values remain
  NULL. It runs in a bounded-lock transaction and does not repost old journals.
  **Apply/verify this migration before deploying dependent code.**
- Invoice cash/bank receipts reuse the existing finance guard, one-source rule,
  idempotency, outstanding amount checks and mandatory receipt-review workflow.
  Receipt records link back to the invoice. Customer PDFs retain price modes and
  supplier-cost confidentiality; included prices now use two decimal places.
- Local verification: 176 backend tests, 18 staff tests, lint/typechecks,
  backend/website builds and packaging; 19 disposable PostgreSQL 17 checks; full
  HTTP/SMTP journey including invoice retries, supplier unit costs, linked receipt
  review, both PDF modes, scoped/anonymous denial and existing recovery passed.
- Synthetic browser invoice: quantity 2, unit buying 60.25, unit selling 100.25,
  tax 1.25, discount 0.25 => buying 120.50, selling 200.50, customer total 201.50.
  Cash receipt 201.50 updated the invoice, review succeeded and its invoice link
  opened the authorized saved record. Add/remove line controls passed. Final
  display corrections (invoice-number heading/two-place history amounts) passed
  lint/typecheck and the invoice-label regression; exact remote CI is pending.
- Owner authorized finishing this increment and deploying all ready changes once,
  without external notifications. The owner also authorized deleting old CRM
  vouchers, but none have been deleted; that reset remains a separate cutover
  after the replacement voucher set is ready. No new backup was requested.
- Remaining full-reference work: multi-ticket vouchers, complete cash/bank/expense
  editors, combined packages, remaining service/group-seat editors, advanced
  ledgers/reports and deliberate removal of legacy dependencies.

### Deployed schema reconciliation

Read-only production comparison found a missing `Customer_email_key` unique index, five historical `updatedAt` defaults, and a different transport status default. Duplicate non-null email groups: zero. Migration `20261127150000_reconcile_deployed_schema` restores the declared schema in a bounded transaction without updating/deleting rows. A disposable regression recreates the drift, checks row preservation and verifies that duplicate emails abort rather than merge/delete records.

Two already-completed historical migration checksums differ from both reviewed LF and CRLF bytes: editorial revisions and customer password recovery. Existing production tables, foreign keys, checks, RLS and public access restrictions were inspected; historical checksums must remain unchanged. This is recorded historical provenance drift, not proof that the original applied files were recovered. Deployment requires catalog/schema reconciliation and both pending additive migrations, with exact history identities retained.

### Cash voucher increment

The signed-in reference cash-voucher form was inspected read-only: account, description, payment/receipt rows, add-row and totals. No reference records were submitted. A new protected cash-voucher workspace reuses the existing voucher review, durable retry identity, saved-submission recovery and journal-history links. Backend expansion uses established cash ledger code 1100 and a separate balancing cash leg for every row, preserving gross receipts and payments even when net movement is zero. Cash cannot be selected as its own counterparty. Existing active posting-account, branch/linked-customer, supplier and PKR rules remain authoritative.

This is ledger recording, not booking settlement or a bank transfer. The page labels net cash movement; it does not invent an opening or closing cash balance. Customer receipts and supplier-payment workflows remain the paths for source settlement. Full reference table/layout, dated closing-balance presentation and bank voucher parity remain separate acceptance work. No migration or historical voucher reset is included.

Cash increment local evidence: 177 backend and 18 staff tests, both lint/typechecks, backend and production website builds, standalone packaging, both full moderate audits (zero vulnerabilities), 36 selected PostgreSQL checks and complete HTTP/SMTP journey passed. Cash-specific coverage includes gross equal payment/receipt legs, four concurrent submissions producing one journal, changed-payload rejection and inactive-cash rejection with successful original retry. Scoped and anonymous cash POST denial passed over HTTP. Synthetic browser cash payment 100.25 posted and confirmed; fresh-voucher, add-line and desktop no-overflow checks passed. No production cash entries were created.
