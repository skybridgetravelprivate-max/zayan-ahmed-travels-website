# Remaining module parity review — 28 November 2026

Reviewed deployed source: `1eb8d50b4d2c39a203105e816136feff055dc193` (cash voucher release). This is an independent implementation, not the reference application's private source or database. No percentage or full-parity claim is justified.

## Evidence and limits

The initial inspection encountered an expired reference session. After the owner signed in again, 59 authenticated destination pages were inspected: 13 entry forms, 19 reports, and 27 list/setup pages. Their static labels, field names/types, filter controls and available table headings are captured in `reference-module-fields-20261128.json`. Input values, option/record contents, customer data and credentials are excluded. Pages without generated report tables were inspected only in their initial filter state; this does not establish their result columns. The reference dashboard and cash form were also inspected separately.

Client-side Add Ticket, Add Hotel, Add Visa and Add Transport each increased the relevant row count from one to two. Evidence is in `reference-row-controls-20261128.json`. No form was submitted, deleted or edited on the server. No original source/schema, financial formulas, postings, refund rules, print output or successful write behavior was recovered or verified. Current CRM code inspection does not substitute for fresh cross-application browser acceptance. Earlier synthetic/CI evidence is historical evidence, not newly rerun for this read-only review. The fresh reference ticket screenshot was at a narrow browser viewport, not a desktop pixel-parity test.

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

1. Field/filter/header inventory is now captured. Complete generated report results, print, empty/error states and desktop/mobile side-by-side checks. No reference transactions should be submitted; formulas remain unverified until agreed and tested with synthetic data.
2. Multi-ticket voucher and group-seat booking/allocation; separate them from PNR historical grouping.
3. Unified package component editor; dedicated hotel, visa and transport invoice editors over established transaction services.
4. Cash opening/closing and filtered history, bank/expense voucher screens, customer-ledger and consolidated invoices.
5. Report catalogue gaps, consultant/GDS/BSP source mapping, setup/profile/language/theme and print/mobile/keyboard comparison.

No code, production data or deployment was changed by this audit. No tests were added/run for this documentation-only review. Successful releases do not prove all-module parity.

## Fresh authenticated findings

The inventory supersedes the earlier session-expiry limitation and “reference fields unverified” statements above. Functional write/financial equivalence and pixel-level layout remain unverified.

| Area | Newly observed reference details | Difference confirmed against current code |
|---|---|---|
| Unified entry voucher | Journal, bank payment/receipt, cash receipt/payment and expense selectors; manual voucher number; top account; row totals/difference | Current journal and cash screens are separate; unified type switching/manual numbering and bank/expense presentation absent. |
| General invoice | Consultant, manual number, supplier/customer descriptions and phone; independent buying/selling currencies and ROE; receiving rows | Current shared quantity invoice is PKR-based, with no consultant/manual number, dual-currency/ROE or equivalent receiving grid. |
| Quick invoice | Supplier/customer plus repeated quantity, buy/sell rate, per-row profit and receiving accounts | Current quantity editor approximates core data; separate reference layout and per-row displayed totals/profit remain gaps. |
| Ticket invoice | Repeated travel date/PNR/ticket/passport/sector plus separate buying/selling and receiving rows | Current active ticket issue form is a single ticket. |
| Full ticket | Repeated supplier/customer/passenger rows; dates/PNR/GDS; named tax buckets; commissions/WHT/PSF percent and amount pairs; dual currency/ROE; repeated flight legs | Core single-ticket UI omits these repeated grids and detailed charge fields. Their calculation meaning/rounding must not be inferred from labels. |
| Hotel invoice | Repeated customer/supplier/Shirka, room/meal/view, nights, adults/children, confirmation, per-night buy/sell, dual ROE; cancellation deadline/payment status | Existing hotel reservation uses whole-stay prices per room; this is a different pricing basis and cannot be relabeled per-night without conversion tests. |
| Visa invoice | Repeated customer/supplier/Shirka, traveler/passport/visa/status/dates and independent buy/sell/ROE; dated receiving rows | Existing application maintenance/PDF is not this financial invoice editor. |
| Transport invoice | Repeated customer/supplier, date/time, registration/capacity/driver, route and buy/sell/ROE plus flight rows | Current active workflow captures one trip and aggregate totals; no equivalent combined transport/flight row editor. |
| Quotation | Validity/travel dates, title/destination/type, contact/address, repeated service/pax/unit amount, GST and totals | Current quotation create/add-item flow lacks the equivalent complete one-page form. No GST policy inferred. |
| Package | Customer/consultant/commission plus repeated visa, ticket, hotel, transport and flight components | Existing Umrah booking/catalogue does not provide a matching combined component editor. |
| Multi invoice | Customer and from/to date filters | Dedicated consolidated invoice view missing. |
| Group inventory | Supplier, sector/category/name/PNR/seats, repeated flight legs, adult/child/infant buying and selling rates | Existing TicketGroup metadata omits this full inventory/rate/flight editor and booking screen. |
| Consultant/Shirka | Consultant contact + sale percentage; Shirka type/contact | Separate active modules/mappings absent. Commission and type semantics still need defined mapping. |
| Profile/airline | NTN/license/VAT, logo/stamp/banner and display toggles; airline shortcode, numeric code and logo | Current setup/resources do not establish equivalent field coverage or branding controls. |
| User permissions | Add/view vs edit permissions per voucher, buying visibility, receiving edits, date edits and voiding | Existing role/branch model is different; no grant/removal is justified merely to copy checkbox appearance. |

Fresh report filters additionally confirm: head-wise trial balance has account head; period trial balance has from/to; monthly P/L uses months; recovery lists received/remaining/pending-since; consultant includes commission; airline and GDS reports include buying/selling/profit; nearby stays include supplier/confirmation/meal/nights. Current report UI lacks these complete combinations. Existing finance APIs for balance sheet/general ledger/cash flow remain backend capabilities, not equivalent screens.

### Audit delivery

Documentation only. No application change, new deployment, financial write, deletion or schema change. Initial documentation head `e1ba815` and this follow-up must be distinguished from the previously deployed application. Check exact remote CI before describing this review PR's checks as passed.
