# Readiness acceptance — 22 November 2026

Verdict: deployed hardening is verified; platform acceptance remains open. This review does not authorize deployment, production upload activation, policy publication, financial writes, key distribution or paid resources.

## Baseline and evidence boundaries

Clean checkout began at PR #44 head `b386302b431299ef2f89f607dbf829c5130eed8d`. The review branch starts from merged production `67c4d19c1876f78b01f66c32bfd2f8cdeba821bd`, whose tree matches that head. hPanel readback on 22 November confirms Completed deployment `01a1ff19-6758-70a7-b6f7-983d42790eb3`, that exact commit and auto-deployment off. Public health returns HTTP 200 with database healthy. Exact release CI run [44928650353](https://github.com/skybridgetravelprivate-max/zayan-ahmed-travels-website/actions/runs/44928650353) passed; this is reviewed historical CI, not a newly run check.

Both full audits were rerun, including development dependencies at moderate: website zero vulnerabilities, backend zero vulnerabilities. Neither lockfile nor audit policy changed. Production schema readback has 18 completed migrations; document inventory is empty. No production migration was attempted in this review.

The prior encrypted backup SHA256 was rechecked and matched `a9c13bc30fba7b1437de8f6693ab4488bd3d8b781d85363c9c8a4cae8435f1af`. Its 21 November isolated restore/fingerprint evidence was reviewed, not rerun today. It covers the earlier public-schema snapshot, excluding later writes, other schemas, object bytes and platform configuration. The prior synthetic financial/object recovery drill is separate evidence, not production-data recovery.

Connected discovery returned only the production Supabase project, not an approved hosted staging environment. Its document bucket is private with an 8 MiB limit and approved MIME allowlist, storage.objects RLS enabled and zero policies; both object and StoredDocument counts are zero. This is read-only configuration evidence, not hosted acceptance. Accessible Drive searches found no matching artifact/folder; limited search results do not prove no offsite binary exists. No independent custodian or approved destination was identified.

## Current reproducible verification

On a fresh disposable PostgreSQL 17.12 cluster bound to loopback with timezone UTC, all 18 migrations applied and 60 tests passed with zero skipped. Suites:

- `backend/apps/api/src/umrah/lifecycle.pg17.spec.ts`: cancellation atomicity, terminal-state protection and posted-booking financial review hold.
- `backend/apps/api/src/workflows/remaining-workflows.pg17.spec.ts` and `reservation/reservation-completion.pg17.spec.ts`: supported replacement/reservation operations and accounting.
- `backend/apps/api/src/workflows/ticket-journey.pg17.spec.ts`: issuance, reviewed settlement, exact balances, PDFs, linked-owner denial and refund credit.
- `backend/apps/api/src/workflows/visa-journey.pg17.spec.ts`: supported intake/status projection, private PDF, isolation and cancellation/rejection without invented financial writes.
- `backend/apps/api/src/documents/persistence.pg17.spec.ts` and `documents/private-storage.pg17.spec.ts`: local/private HTTP adapter persistence, authorized/denied reads, outage/missing bytes, metadata preservation and restoration across processes. This is not hosted Supabase testing.
- `backend/apps/api/src/finance/hardening.pg17.spec.ts`: payroll authority/idempotency, exact aggregation/FX containment and communication uncertainty/replay protections.

The existing `backend/scripts/quotation-http-journey.cjs` passed against the disposable database and local SMTP capture: privileged branch roles 403 with no audit disclosure/journal write; Super Admin audit/journal success; receipt retry/reconciliation; private PDFs; linked customer/foreign selector isolation; generic recovery responses, hash-only reset tokens, expiry/concurrent/reused-token rejection, password replacement and session revocation. It also exercised local CMS outage/fallback/restoration. No live recipient or production account was used.

The 12 synthetic document-backup tests passed using `npm run test:document-backup --prefix backend`. Root-CWD invocations of backend-only test suites failed relative subprocess-path assumptions; using their backend working directory corrected this. Reusing a populated fixture DB also conflicted with fresh-database assertions; the accepted 60/60 run used a reset disposable DB. These operator setup failures did not establish application defects and no assertions were weakened.

The Chrome 157 journey also passed all 15 recorded browser checks against a separate fresh synthetic database: multi-tab/lost-response receipt protection, browser closure/reopen, staff reauthentication, owner/other/owner cache isolation, private PDFs, actual ticket/transport/visa forms and Umrah cancellation holds, plus the communications review workspace. The combined HTTP result contains 23 recorded checks. Customer and communications workspace axe scans found zero violations; incomplete/manual items remain, including color contrast. Mobile/desktop account layouts and mobile375 communications layout passed the selected checks. The separate hotel Chrome journey passed multi-room/guest transfer, check-in/out, receipt/receivable, private PDFs, two customer logins with completed-booking isolation and selected mobile375/desktop1440 fit checks. It generated long-content multipage PDF fixtures; these newly generated PDFs were not visually re-reviewed in this run. Local rendering/navigation samples are observations, not production latency or availability targets. Packaging regression passed. The synthetic cluster was stopped after verification. The test harness/cluster operator files stay outside the repository. No production customer data was used in the new test cluster.

## Prioritized acceptance backlog

| Priority/type | Reproduction and source evidence | Remaining acceptance / decision |
| --- | --- | --- |
| P1 verification | Local backup hash and prior restore pass; no approved remote artifact/custodian was found. `docs/public-schema-restore.md`. | Retrieve approved ciphertext independently, exercise separate custody, restore/fingerprint/time the drill. Approve destination, custodian, retention and recovery targets. |
| P1 verification | `common/storage.service.ts`, `documents/documents.controller.ts`; local adapter tests pass, production flag disabled. | Approved isolated hosted target and credentials through private configuration; execute every row of `recovery-storage-acceptance.md`; separately review activation. |
| P1 missing requirements | Live `/privacy`, `/terms`, `/refund-policy` each return 200 with placeholder wording. Source: `src/app/{privacy,terms,refund-policy}/page.tsx`; drafts: `docs/policy-owner-review.md`. | Confirm legal identity/contact, fields/processors/disclosures, retention, booking acceptance, complaints/jurisdiction, service rules, wording and effective date. Do not publish drafts. |
| P1 missing requirements | Posted Umrah cancellation retains review hold; ticket refunds create credit. `umrah/lifecycle.pg17.spec.ts`, `workflows/ticket-journey.pg17.spec.ts`. | Accountant/owner defines payouts, supplier recovery, fees, currency/tax and period closure. Do not treat credit as cash paid. |
| P2 verification/requirements | Supported ticket/hotel/Umrah/transport/visa operations have service-level and selected browser evidence. | Supplier/GDS/Nusuk/provider sandbox acceptance; transport lifecycle and visa transitions/customer wording; full settlement rules. Software Completed/Approved is not evidence of external fulfillment. |
| P2 verification | `health.controller.ts` detects DB health, including prior local outage/recovery evidence; no independent alert delivery established. | Approve monitoring provider, recipients, escalation and maintenance owner; test staged failure/recovery with controlled inbox before notification activation. |
| P2 missing requirements | `src/components/account/ProfileSummary.tsx` is read-only; `AccountHome.tsx` directs inquiries to travel desk. | Proposed display-name/phone audit-backed editing and verified ownership-linked inquiry history; owner selects scope and identity/email verification. Existing behavior is not classified as a defect. |
| P2 verification | Selected keyboard, reflow, axe and long hotel-PDF checks passed historically. Current service tests verify private PDF behavior. | Broader public/account/staff page coverage, languages/fonts and extreme content across remaining PDFs; approve representative devices/data and performance targets. No full accessibility certification/SLO is claimed. |

## Resolved findings and concrete delivery

Authorization and customer recovery from PR #41, ownership/document errors from PR #42/#43, and exact accounting/communication hardening from PR #44 are deployed historical fixes. New tests above preserve those behaviors. Prior dependency advisories do not remain open: both current full audits are clear.

Confirmed documentation defect: readiness introductions still described PR #43 as current and PR #44 as review-only. Corrected them and added a concrete offsite/hosted drill plus separate activation procedure. No new application defect was established by this review. No optional feature or financial/legal rule was invented.

Existing open PRs #6, #9, #11 and #29 were observed; they were not merged or assumed safe merely because newer releases exist. This focused documentation review does not supersede their independent review.

## Owner action packet

The delegated technical defaults are proposed in `recovery-storage-acceptance.md`: private owner-controlled offsite storage, separately held recovery identity, 24-hour recovery point/eight-hour recovery time and synthetic-only hosted acceptance. They are not implemented guarantees. Supply the actual destination/artifact link, independent custodian identity and approved non-production project/access. Do not paste secrets into chat. Name monitoring/finance/policy decision owners and supply existing supplier sandbox approvals. Without these real identities/access/decisions, the associated acceptance cannot be completed by changing application code.
