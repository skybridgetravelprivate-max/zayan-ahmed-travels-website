# CRM/admin experience candidate — 30 October 2026

## Scope and baseline

Local-only repair of the confirmed CRM/admin review findings. Baseline `250bf07a9cfed0c05db1bb5893856ed4ed2a8f8d`; branch `repair/crm-admin-experience-20261030`. Local/remote release identity and read-only live runtime were rechecked: Hostinger `01a18bbc-db54-7301-a3f3-0333c6f9f518` remained current, uploads false. No push, deployment, production business/schema/permission/credential change, backup operation, provider activation or message was performed. Everything used existing free tools/allowances. No additional agents.

## Fixed behavior and acceptance matrix

| Finding | Final behavior | Acceptance evidence | Status |
| --- | --- | --- | --- |
| Misleading KPI scope/period | New operational summary labels new customers/inquiries, confirmed **Umrah** bookings and current **Umrah** visa pipeline; company timezone, branch scope, month-to-date and each counter basis explicit | PG17 month boundary, future-date exclusion, module authority; actual admin browser labels | Fixed/verified in scope |
| Operational role rejected at homepage | Every authenticated role receives its permitted modules; no lead/dashboard permission required simply to land on useful work | Operations-only and read-only browser logins; denied CRM/dashboard APIs; PG17 catalogue | Fixed/verified |
| Website-only role navigation | Dedicated website destination preserved through its existing cms.view authority; generic CMS resource access remains blocked | PG17 catalogue and browser website-only login/generic403 | Fixed/verified |
| Hidden mobile navigation | Grouped permission-derived desktop navigation, explicit mobile disclosure, current module/breadcrumb, skip link; Escape closes and returns focus | Browser keyboard/Enter/Escape, focus checks,320/375/768/1440 samples | Fixed/verified |
| Split lead screens | Management lead workspace is canonical; legacy list preserves q/page and record URLs redirect with record selector; existing assignment/status/note/follow-up/task/quote controls reused | Actual public inquiry→admin branch triage→sales assignment→follow-up/completion→customer/quotation; legacy links and viewer denials | Fixed/verified selected journey |
| Raw IDs / generic cards | Scoped batched related names, linked business references, grouped nonempty details, technical IDs under disclosure; CRM-specific table columns and mobile cards | PG17 foreign label/record exclusion; actual lead/customer/quotation UI; screenshots | Fixed/verified |
| Dates and amounts | Read-only values use company time and exact decimal strings; calendar filters use company dates; existing UTC edit interpretation retained and labelled explicitly | Calendar/DST tests, large/fractional decimal staff regression, browser Due At (UTC) form | Fixed/verified |
| Missing list filters | Status/owner/branch/created-company-date filters where fields exist, safe sort and stable ID tie-break, server totals before pagination; URLs preserve state through reload/detail return | PG1725-record/two-page predicates/counts and foreign branch exclusion; actual filter/sort/reload/return browser | Fixed/verified |
| Misleading capability descriptions | Module descriptions include the actual permitted domain workflows without enabling generic financial writes | Role-based UI, hotel workflow regression, existing permission tests | Fixed/verified |
| Empty dashboard dominates | Scoped summary/useful modules precede due work; genuinely empty queues are compact expandable details; unavailable remains distinct from zero | Browser states and screenshots | Fixed/verified |
| Public sales contact inside staff pages | Public sales contact is now owned by public chrome; private staff routes omit it | Actual public contact presence/staff absence browser checks | Fixed/verified |
| Zoom clipping discovered during QA | Long email grid cell cannot widen the record at200%text; controls/containers bounded | Body/html/viewport375, zero offscreen checked elements; screenshots inspected | Fixed/verified sampled reflow |

## Ownership and compatibility

Next.js/NestJS/PostgreSQL retained. No new application dependency, migration, worker, Redis or parallel CRM implementation.

- `GET /api/v1/dashboard/workspace` is a new operational endpoint under dashboard.view. It counts only modules the actor may read. It uses the shared company-calendar helper and the response generation time. The legacy financial summary endpoint is preserved; this candidate does not certify its historical aggregate definitions or reinterpret snapshots as ledger revenue.
- Existing management list/detail and mutation contracts remain. Optional `presentation=true` enriches lists. New `/:resource/:id/summary` uses existing record authorization before returning allowlisted display metadata. Labels are batched, bounded to20 parent IDs per reference field and scoped; absent authority yields an unavailable label, never a foreign name. Branch/staff labels use authorized branch membership; only safe identity fields are selected.
- Existing branch-scoped staff-name options can now serve lead/task/follow-up viewers for owner filters. No role memberships, production permissions or credential data are changed/exposed. Generic CMS access stays administrator-only even when the separate website destination is available.
- Only the CRM resources with established fields expose these filters. A customer has no invented assigned-staff/status field. Date range means creation date in company time; end date is inclusive through the next local midnight. Sort keys are allowlisted, malformed dates/search parameters rejected, authorization predicates combined with filters rather than overwritten.
- Legacy `/admin/leads` and `/admin/leads/:id` are redirects to the canonical screen. Backend lead APIs remain unchanged. Invalid record selectors produce explicit feedback.
- CRM workspace `preview=true` limits related collections to20 without changing full-workspace callers. Customer previews suppress outstanding totals rather than summing a truncated booking list. Activity is labelled notes/communications/follow-ups, not a complete audit trail or delivery proof.
- Read-only formatting never changes payload values, prices, account mappings or statuses. Existing date-entry payloads remain UTC; visible labels clarify this rather than silently changing interpretation.

## Validation

All acceptance data was disposable synthetic PostgreSQL17 on127.0.0.1. Application processes received clean whitelisted environments, generated synthetic authentication secrets and loopback database URLs only. The main browser refuses repository and ancestor environment files; no production credentials or restored customer data entered test processes.

| Check | Result |
| --- | --- |
| New admin PG17 tests | **6 passed**, including parent; counters/timezone, future timestamps, filter counts/pagination/scope, safe references, bounded preview and operational/CMS role catalogue |
| Backend regressions | **145 passed** |
| Staff regressions | **12 passed**, including exact large-decimal/company-date presentation |
| Existing CRM PG17 regressions | **19 passed**, including parent; stale versions, permissions, transaction/audit behavior and reminders |
| Receipt recovery PG17 | **5 passed**, including parent; duplicate/retry/review safeguards retained |
| Hotel PG17 | **13 passed**, including parent; scope, capacity, occupancy, concurrency and allocation rollback |
| API and website type checks | Passed |
| API and website production builds | Passed, packaged Next/Nest artifact |
| API lint | Passed, zero warnings |
| Website lint | Zero errors; two pre-existing StaffSessionForm navigation warnings |
| Actual Chrome CRM journey | Passed; administrator, CRM, operations-only, read-only and website-only staff; same-origin HTTP authorization checks |
| Main CRM workflow | Public inquiry→unrouted branch triage→eligible assignment→follow-up create/complete→customer/package quotation1000.50; unconfigured delivery remains DRAFT |
| Customer and list acceptance | Converted customer links to related quotation; quotation list has business reference;25 results across two filtered pages persist through reload and return |
| Accessibility samples | Axe A/AA tags through WCAG2.2: zero findings on dashboard, filtered list, lead record and customer record; keyboard disclosure/skip focus and enlarged-text checks passed |
| Shared hotel browser regression | Separate fresh database; two rooms/three guests, transfer, check-in/out, one receipt250.25; net2001.00, booking balance and posted AR1750.75; balanced journals, private PDFs and customer projection |
| Visual review | Dashboard/list/lead/customer/mobile screenshots inspected;320/375/768/1440 samples and200%text; long email overflow reproduced then corrected |
| Patch | Whitespace check passed; final source manifest/reverse-patch verification recorded separately |

Counts include parent tests where noted; no summed total disguises those parents. Tests were reused where unchanged, and repeated only for integration changes/failures. Earlier browser failures exposed inaccessible select names and a zoom grid defect; both corrected. One asynchronous navigation test was changed to await the actual Next route transition.

Reproducible project commands: `npm test --prefix backend`, `npm run test:staff`, `npm run test:admin:pg17 --prefix backend`, `npm run test:admin:browser --prefix backend`, `npm run test:crm:pg17 --prefix backend`, `npm run test:hotel:pg17 --prefix backend`, both builds and lints. PG/browser commands require explicit synthetic database variables and installed Playwright/output paths. Task wrappers and detailed logs are outside the source release in the workspace work directory.

## Meaningful limits

This is a tested CRM/admin experience candidate, not full-platform completion or formal accessibility certification. Screen-reader-specific validation, comprehensive browser/OS coverage, true browser zoom beyond the recorded reflow/text-scaling samples, production load testing and every operational module/role combination remain unverified. Filtered lists are live operational reads, not a cross-request immutable reporting snapshot.

The new dashboard is not an accountant-approved all-service financial dashboard. No refund, tax, currency, payout or retention rules were invented. Existing supplier integrations, policy drafts, customer-account recovery/delivery, SMTP correction, uploads, monitoring and offsite/full-project/Linux recovery gates remain outside this repair. No existing production content/policy was published and no mail was sent. Production and hosted CI have not run this candidate because there is no push/deploy authorization.

## Recovery and next release gate

No schema migration or data rewrite is required. Preserve the current production schema, environment and all payment safeguards. Local release patch/source archive and checksums contain source only; no browser profiles, customer records, environment files, uploads, dependencies or backups.

Before a future release, freshly recheck current HEAD/deployed identity/live mapping, review caller compatibility for added query parameters and legacy UI redirects, and obtain the required approval to retain/verify the exact then-current application artifact. This task did not export/retain a new production bundle or refresh production backup/recovery evidence. The earlier1b9aa05 bundle is not the default rollback for this candidate: current250bf07 includes hotel protections that must be preserved.

If this candidate is later deployed and rollback is needed, use the exact verified250bf07 application/source or the newer pre-release baseline, under the separately approved write-maintenance procedure. Keep receipt/review safeguards active, assess uncertain submissions, and verify identity, health, authorization and cache protections before reopening. Never restore a database snapshot to undo this code release. Full Linux runtime rollback remains unverified; do not claim a local source reverse check proves it.

**Next approval:** separate authorization for fresh release/recovery/artifact verification, then approval of the exact final candidate commit push to cursor/customer-account-bookings and its automatic Hostinger deployment after those gates pass. No production migration, policy publication, provider/upload activation or business-data change is proposed.
