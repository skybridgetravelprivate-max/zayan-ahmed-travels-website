# Remaining module parity review — 28 November 2026

Reviewed deployed source: `1eb8d50b4d2c39a203105e816136feff055dc193` (cash voucher release). This is an independent implementation, not the reference application's private source or database. No percentage or full-parity claim is justified.

## Evidence and limits

Newly inspected: reference navigation rendered in the existing authenticated Assan Accounts cash-voucher page, including its module links; current code contracts, workflows, report catalogue and page components. The reference cash form has account/description/payment/receipt rows, opening cash display, totals and closing cash. Its current form was inspected without submitting anything.

The reference session expired when navigating to Entry Voucher. Subsequent form destinations redirected to Login. Those redirects do **not** count as inspecting the forms. Their internal fields, validations, resulting postings and current visual appearance remain unverified. No reference financial records were changed. Current CRM code inspection does not substitute for fresh browser acceptance. Earlier synthetic/CI evidence is historical evidence, not newly rerun for this read-only review.

## Entry, service and setup comparison

Reference Add/View destinations are included under their module family below. “Partial” means an implementation exists, not that financial semantics or layout match.

| Reference module / screens | Current CRM evidence | Confirmed difference / remaining acceptance |
|---|---|---|
| Home / overview | `src/app/admin/(workspace)/page.tsx`, `AccountingBalances.tsx`, daily operations | Existing actual ledger/counter cards; reference has voucher lookup, today's activity and upcoming tables not reproduced fully. Fresh side-by-side visual comparison pending. |
| Accounts / head-wise accounts | customer/supplier/agent resources; `accounting-workspace.ts` | Separate resources exist; reference unified account/head-wise navigation and statements not reproduced. |
| Chart of accounts | `resources/resource-contract.ts`, generic management workspace | Hierarchical/posting/currency fields exist; reference tree, head operations and layout unverified. |
| Entry Voucher / all vouchers | `JournalVoucher.tsx`, `finance/manual-vouchers.ts` | Balanced multi-line manual journals exist; unified reference entry-voucher types and listing equivalence unverified. |
| Journal Voucher / all JVs | same journal editor and journal records | Posting/reversal and durable retries exist. Compact table layout, voucher-type filtering and print parity incomplete. |
| Cash Voucher / all CVs | cash page, shared journal component, `postCashVoucher` | Payment/receipt rows and per-row cash legs implemented; cards differ from reference table; net cash movement is not a dated opening/closing balance. Cash-specific filtered history missing. |
| Bank entry / bank flows | bank accounts, BANK receipt/payment methods, finance cash-flow API | No dedicated bank-voucher editor equivalent to reference entry flows. BANK method does not imply bank-provider integration or transfer. |
| General invoice / all invoices | `ServiceInvoices.tsx`, `finance/service-vouchers.ts`, PDF service invoice | Quantity buying/selling/supplier/receipt flow exists. Reference general/quick invoice distinction and exact list/print appearance unverified. |
| Quick invoice / all quick invoices | same general/quick editor | Separate reference quick-entry workflow not reproduced independently. |
| Ticket invoice / all T.Invoices | generic ticket issue workflow and issued ticket records | Separate ticket-invoice form equivalent not established. |
| Full ticket / all full tickets | `staff-workflows.ts` tickets, `workflows.controller.ts` | Single ticket/passenger, independent buying/selling, cabin/baggage/arrival exist. Multi-passenger voucher and flight-segment table missing from active editor. |
| Refunded ticket / all refunds | existing refund controller, ticket-refund records | Exact/idempotent refund behavior tested historically. Reference refund presentation/formulas unverified; do not copy fees without approved rules. |
| Hotel invoice / new and OLD lists | hotel-reservation workflows, bookings/vouchers, hotel PDF | Single-stay/room/guest workflow exists; reference multi-row hotel invoice and legacy-list equivalence unverified. |
| Visa invoice / new and OLD lists | generic visa-application resource and application PDF | Current active form is an application record, without invoice buying/selling/paid fields. Application PDF explicitly is not a visa. A financial visa invoice editor remains a gap. |
| Transport invoice / all | transport creation workflow and voucher PDF | Pickup/drop-off/date/pax/buying/selling/paid exist; repeated supplier/customer invoice rows and reference table/print parity unverified. |
| Quotation / add/all | quotation create/item/send workflows | Item-by-item quotation flow exists. Reference one-page service quotation layout and multi-service comparison unverified. |
| Package Entry / all PVs | Umrah booking workflow and package catalogue | Package selection and aggregate booking amounts exist. No unified active editor assembling visa+flight+hotel+transport component rows with reference-like totals. |
| Multi Invoice | individual service invoices/PDFs | No dedicated customer/date-range consolidated multi-invoice page established in current custom workspace. |
| Group Tickets: add group / view-booking / all bookings | TicketGroup resource (total/reserved seats), PNR resources | PNR grouping is not seat inventory. TicketGroup metadata exists; dedicated reference-style booking/allocation/release journey absent from active workflow catalogue. Umrah-group allocation is a different entity. |
| Create user / all users | guarded user resources and existing role/branch model | Existing create/edit flows and distinct sign-in portals; reference per-module permission editor parity unverified. |
| Consultant | agents/users/commission resources | No dedicated consultant maintenance/report module in active accounting profile. Do not relabel staff as consultants without mapping. |
| Shirka | supplier/agent records | No separately mapped Shirka module or approved field semantics established. |
| Company profile | company settings/backend and document branding | Reference profile editor/layout parity not established. |
| Add bank | bank-account resources | Maintenance exists; bank-specific fields/layout and opening-balance posting equivalence unverified. |
| Add airline | airline resources | Basic name/code/status maintenance exists; extra reference fields unverified. |
| Change password | staff auth/recovery flows | Recovery exists; a directly equivalent signed-in change-password screen is not established by this review. |
| Language and theme | reference exposes EN/Urdu/Arabic and light/dark controls | CRM active workspace does not establish equivalent language/theme switching. |

## Report-by-report comparison

Sources: `backend/apps/api/src/reports/reports.service.ts` (19 catalogue entries), `reports/misc.controller.ts`, `finance/finance.controller.ts`, `finance/accounting.service.ts`, `src/components/admin/AccountingReports.tsx`. Finance API availability is not UI parity.

| Reference report | Current equivalent / gap |
|---|---|
| Full trial balance | Report catalogue and finance API available; shared table/CSV UI. Print and reference grouping/layout unverified. |
| Head-wise trial balance | No dedicated head-wise report page/filter in custom report workspace. |
| Period-wise trial balance | Current UI offers a cutoff; no dedicated period movement/opening/closing trial-balance screen. |
| Balance sheet | Guarded finance API exists; absent from the 19-item report UI catalogue. |
| Daily cash flow | Guarded cash-flow API exists; no dedicated reference-style daily cash page. |
| Daily bank flow | No dedicated bank-flow report page established. |
| Monthly profit and loss | Profit/loss catalogue/API exists with date range; monthly presentation/print equivalence unverified. |
| Recovery report | Current receivables and summary exist; ageing/due-date recovery workflow not equivalent. |
| Daily sales statement | Daily-sale report exists; reference filters/columns and posted-vs-source reconciliation require comparison. |
| Today activities | Daily service counters exist; consolidated voucher activity table missing. |
| Consultant report | Not in active report catalogue. |
| Sale report | Daily-sale exists; full reference sale dimensions unverified. |
| BSP report | Not in active catalogue; provider data and settlement definitions unestablished. |
| Upcoming flights | Dashboard counts only today's issued ticket records; no reference-equivalent upcoming flight list in active reports UI. |
| Airline report | Not in active report catalogue. |
| GDS report | Not in active report catalogue; GDS/source data mapping required. |
| Nearby check-in | KSA/Makkah/Madinah check-in reports exist; dedicated upcoming/date-window UI and field equivalence unverified. |
| Nearby check-out | Similar existing checkout reports; reference nearby presentation unverified. |
| Nearby transport | Backend transport intimation exists; dedicated nearby transport report absent from active catalogue. |
| Account ledger / detailed ledger lookup | Customer/supplier/agent/general-ledger finance APIs exist; no equivalent unified account lookup + detailed ledger custom page. |

## Priorities

1. Reauthenticate reference and capture each form/list/report's labels, columns, row controls and empty/error/print states. Do not submit reference transactions. Browser-derived formulas remain unverified until tested with approved synthetic data.
2. Multi-ticket voucher and group-seat booking/allocation; separate them from PNR historical grouping.
3. Unified package component editor; dedicated hotel, visa and transport invoice editors over established transaction services.
4. Cash opening/closing and filtered history, bank/expense voucher screens, customer-ledger and consolidated invoices.
5. Report catalogue gaps, consultant/GDS/BSP source mapping, setup/profile/language/theme and print/mobile/keyboard comparison.

No code, production data or deployment was changed by this audit. No tests were added/run for this documentation-only review. Successful releases do not prove all-module parity.
