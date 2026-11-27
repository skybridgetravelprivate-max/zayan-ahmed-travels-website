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
  Remote CI and the final filter browser recheck remain pending.
