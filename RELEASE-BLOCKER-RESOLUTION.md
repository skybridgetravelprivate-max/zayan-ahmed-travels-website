# Release blocker follow-up — 2026-10-24

## Current checkout review — 2026-10-24

**NO-GO unchanged.** Reviewed the accumulated tracked diff and untracked receipt
helpers/harnesses after reading AGENTS.md and the validation/release notes. All
earlier uncommitted fixes and unrelated changes were preserved.

Confirmed and fixed one package-budget defect: the direct lead-to-booking
fallback created a quotation with a positive package total but no line items.
It now creates one package line with quantity 1 in the existing transaction,
matching the regular quotation path. No historical quotation or payment was
rewritten; receipt protection is unchanged.

The new synthetic PG17 regression reproduced the defect before the fix. After
the fix, the focused lead-quotation tests report **2 passed, 0 failed, 0 skipped**.
API typecheck (`tsc --noEmit`) and CRLF-aware diff check passed. Earlier browser,
cache, receipt, rollback-compatibility and build results were reused; no broad
audit or build rerun was needed for this single nested-create change.

Fresh read-only deployment investigation returned:

- GitHub repository deployment collection: **empty**.
- GitHub Actions artifacts: **total_count 0**.
- GitHub releases: **empty**.
- Production public `/api/health`: **200**, no valid commit/revision hash in
  inspected provenance fields; connection details and response body suppressed.
- Available browser surfaces: **none**; no existing hosting UI session to inspect.

The GitHub connector rejected the artifact endpoint, so the supported read-only
GitHub CLI was used. No workflow or deployment was triggered. Empty repository
metadata does not prove that the hosting provider has no retained bundle; its
runtime/deployment storage remains inaccessible through the available sources.
Historical local archives and prior database configuration are not accepted as
current deployment evidence. No production database query was repeated.

The smallest remaining blockers are still **verified live database binding**,
the **current deployed commit**, and a **recoverable application bundle tied to
that deployment**. These need current read-only hosting/runtime evidence; no
production change or broader payment reconciliation was added as a requirement.
The original release patch/manifest was preserved and predates the follow-ups.
The temporary PG17 cluster was stopped after targeted validation. No production
writes, additional agents, credential changes, commit, push or deployment occurred.

## Execution follow-up — latest evidence

**NO-GO remains for the production release.** Local browser/cache execution and recorded-base API compatibility are now verified. The two remaining evidence blockers are (1) the live application-to-database binding and (2) the currently deployed commit plus its retained application rollback artifact. Earlier preparation-only statements below are historical and superseded by this section.

### Checks executed

- Actual Chrome **155.0.8059.84**, real Next/Nest handlers, login cookies, loopback HTTP proxy and synthetic PostgreSQL **17**: **passed**, with 12 reported journey checks, including 7 browser check groups. Owner/other/owner at the identical bookings URL returned only each account's booking with private/no-store and no positive Age. Undated booking display, forged-selector isolation, staff PDF access, customer/foreign-staff denial, untrusted Origin, required keys and explicit review passed.
- The browser run again proved two-tab same-key submission, a deliberately lost committed response, reload and complete browser closure/reopen. Exactly 2 receipts remain for the synthetic booking: the earlier HTTP payment plus one browser payment. Net **1010.00**, paid **350.35**, balance **659.65**. The outer HTTP result's 250.25/759.75 describes its earlier checkpoint; `browser-result.json` contains the final browser totals.
- Initial attempts timed out after reopening Chrome redirected to staff login. The harness now performs real staff reauthentication when that redirect occurs, then asserts recovery of the existing local-storage retry key. No key is replaced, no cookie is injected and no payment guard was changed. The final run passed with reauthentication explicitly recorded.
- Extracted exact backend source from recorded Git base `307d174ce77a8eb7b79bd559ff1bad5ea1210c8d` into Temp and compiled with installed TypeScript/dependencies: **passed**. No package download or migration. Generated source archive SHA256: `e4319c86c340a729681b167428fc7c7f8b3fd44cd59876eedcec4110df6c7edf`.
- Executed **5 compatibility check groups** against that rebuilt old API with the candidate gateway retained: real staff HTTP login and candidate `request_` receipt read; receipt PDF in both price modes with private/no-store; anonymous PDF denied **401**; receipt creation/review/case-variant writes blocked **503**; receipt, booking, journal, journal-line and audit snapshots unchanged. Paid/balance remain **350.35/659.65**. Gateway listener was restricted to loopback in the isolated copy. This proves a compatible **recorded-base API + retained guarded gateway** arrangement; it does not certify an unidentified deployed artifact or old frontend.
- Gateway/path/maintenance regression tests: **7 passed, 0 failed, 0 skipped**. Both changed harnesses pass syntax checks; CRLF-aware diff check passes. Earlier 42 targeted tests and application builds reused.

Evidence (synthetic only): `%TEMP%/zat-quote-pg17-validation/browser-cache-reauth/{result.json,browser-result.json}` and `%TEMP%/zat-rollback-base-307d174/{source.tar,rollback-result.json}`. Browser/HTTP services exited and the temporary PG17 cluster was stopped after testing. The compatibility harness is `backend/scripts/receipt-rollback-staging.cjs`; it refuses non-loopback/non-synthetic databases and accepts only the designated Temp baseline directory.

### Live mapping and exact deployed artifact: unverified

Read-only inspection found an existing Hostinger SSH identity and known-host endpoint records, but no SSH config/login mapping; no hosting connector or active browser surface was available. Prior project work, deployment staging directories, backup locations and matching application archive metadata did not establish the live runtime environment or deployed commit. No SSH username was guessed, no production login performed, and no secrets displayed.

A further anonymous production `/api/health` GET returned **200**, with no valid commit/revision hash in the inspected provenance fields. Public health cannot establish DATABASE_URL or associate a local artifact with a running release. The previously queried backup target remains linked to the configured production project, **not independently to the live process**. Its earlier aggregate result (0 receipts/mismatches) was reused without another production query.

Older downloaded source ZIPs and prior local build directories exist, but none was tied to the currently deployed commit. They are not accepted as rollback artifacts. The newly generated recorded-base source archive is available and checksummed for reproducible staging; it is **not a retained deployed application bundle**. Availability and compatibility of the **exact current deployed bundle** therefore remain unverified.

### Smallest remaining blockers / access needed

1. Existing read-only Hostinger deployment/runtime access, or a redacted operator attestation comparing normalized live database host/database/project identity against the backup service target. Passwords and full connection strings must remain private. This closes the database-binding gap; the current zero-count result cannot close it alone.
2. The current deployed commit and a readable retained application bundle with checksum/provenance. With those available, repeat the already-prepared synthetic receipt read/PDF/write-block compatibility check against that exact artifact. The recorded-base rebuild is useful evidence but cannot substitute for it.

No new production action is requested. Actual CDN/secure-cookie behavior remains a deployment acceptance check already documented, not a newly added local blocker. External-client/uncertain-submission checks below remain applicable where such callers or pending submissions exist; this run found no new evidence requiring additional payment reconciliation. Future production changes still require explicit authorization and remain prohibited in this task.

Only test harness/review evidence changed in this execution. Mandatory receipt keys, scope locks and review enforcement are unchanged. The original release patch remains unchanged and predates these local follow-ups; its final packaging/manifest refresh is still pending acceptance. No production writes, maintenance activation, restart, credential changes, paid service, additional agents, commit, push or deployment occurred.

**NO-GO for production release / receipt writes.** Local maintenance preparation is complete; rollback provenance, live database binding and candidate edge acceptance remain unverified.

## Minimal production evidence

Using the existing backup service configuration and credential files, an aggregate-only query completed with `sslmode=verify-full`, a 10-second statement timeout, 1-second lock timeout, session read-only default and an explicit repeatable-read READ ONLY transaction, followed by ROLLBACK. The service file contains the configured production project reference. No credentials, hostnames, customer identifiers, payment amounts or individual records were output. No export, payment reconciliation or production writes occurred.

| Aggregate | Result |
| --- | --- |
| transaction_read_only | on |
| Receipt rows | 0 |
| Historical non-keyed receipt rows | 0 |
| Unreviewed keyed receipts | 0 |
| Receipts missing journals | 0 |
| Unbalanced/empty posted or reversed journals | 0 |
| Booking paid/receipt-sum mismatches | 0 |
| Repeated same-scope/amount/method/day groups in last 30 days | 0 |

This is a snapshot of the **configured production backup target**. The running website's effective DATABASE_URL was not accessible for comparison, so its binding to this target remains **unverified**. Zero persisted receipts cannot prove that no cash/bank payment or failed browser submission occurred outside this database. Pending operator/browser/bank evidence was not available. Do not interpret these counts as authorization to retry an uncertain legacy payment. The query is retained in `backend/scripts/receipt-readonly-assessment.sql`; it returns counts only and performs no financial writes.

## Rollback evidence

Read-only metadata inspection found an encrypted `.pgdump.age` database backup (283776 bytes, dated 2026-10-22), its manifest and recovery status files under `C:/ProgramData/ZAT-Backup`. No application bundle was found in the inspected archive/download/recovery directories. Database backup contents were not decrypted or read. This database backup is **not** an application rollback artifact and must not be restored to undo a code release.

The retained Git base `307d174ce77a8eb7b79bd559ff1bad5ea1210c8d` provides source-level evidence only: Receipt IDs are unrestricted strings and the old receipt PDF uses findUnique by ID, so candidate `request_` IDs fit that schema/read path. The candidate adds no schema migration. The older finance implementation does not provide candidate mandatory-key/review protection. No actual deployed-bundle checksum, deployed-source correspondence, dependency inventory or old-bundle execution against candidate-created synthetic receipts was verified. **Rollback artifact availability and operational compatibility remain unverified.**

## Maintenance control prepared locally

No receipt-specific switch was found in the existing gateway. Added `RECEIPT_WRITES_DISABLED` at its dispatch boundary, using the existing path helper module. Enabled maintenance blocks receipt mutations, including review, with 503/private-no-store/Retry-After; reads and unrelated operations continue. Encoded/case/trailing-slash variants are covered. Invalid nonempty settings fail closed. Disabling maintenance does not change controller duplicate protection.

This is a startup environment control, not an administrative endpoint. Production activation requires an authorized restart. It protects only gateways containing this code; replacing it with an older gateway removes the control. Before rollback, prove an independent proxy block or retain this tested gateway across replacement. Neither production action was performed.

## Authenticated staging preparation and exact proof

Extended `backend/scripts/receipt-browser-checks.cjs` within the existing isolated loopback PG17/Next/Nest/proxy harness. Owner/other/owner requests now hit the **identical** customer-bookings URL with separate authenticated cookie jars, asserting private/no-store, no positive Age, and each expected booking body. Existing recovery, lost-response, review, PDF and unauthorized-document checks are reused. No production login is involved.

New cache assertions: **prepared and syntax-checked; not browser-executed in this follow-up**. To execute, copy the changed harness into the existing built temporary project and use the documented opt-in loopback synthetic PG17 runner with Playwright. The harness refuses non-loopback/non-synthetic database URLs. HTTP staging cannot certify secure-cookie behavior under production TLS termination or CDN cache configuration.

Targeted validation performed:

- `node --test backend/scripts/receipt-maintenance.spec.mjs backend/scripts/hostinger-start.spec.mjs backend/scripts/hostinger-api-path.spec.mjs`: **7 passed, 0 failed, 0 skipped**.
- Syntax checks for gateway and browser harness: passed.
- `git -c core.whitespace=cr-at-eol diff --check`: passed; original tracked gateway files retain CRLF.
- Completed 42 targeted tests, builds and Chrome/PG17 journey reused; not rerun.

The original `release/zat-release.patch` is unchanged (SHA256 `b8b3f437797bef67adf58b07e65acff0159bf510d7908b8ab2ed5177fc3fdfbb`). It **does not include this follow-up**; its source manifest no longer describes the current browser harness. Regenerate/review a final patch and manifest after acceptance of this local control. No commit, push or deployment occurred.

## Exact remaining evidence and approvals

1. **Read-only evidence/access:** confirm the live website database matches the assessed production target; obtain minimal redacted operator/request/bank evidence for any uncertain legacy submissions and inventory external receipt clients. No automatic reconciliation is authorized.
2. **Read-only artifact access:** identify the retained deployed application bundle/config manifest and checksum. Run its read/document compatibility against candidate-created receipts in disposable staging; verify no schema assumptions or startup writes. An older writer must stay blocked.
3. **Local staging work:** execute the newly prepared authenticated cache assertions and a rollback/maintenance drill with the retained artifact. Already authorized by this task; no additional approval needed for isolated synthetic tests.
4. **Explicit future production approval:** authorize retention of the deployed bundle/config, activation/restart of a persistent receipt-write block, and then deployment of the reviewed compatible bundle. This task grants none of those production changes. Prove the block survives rollback before replacement.
5. **Separate acceptance before reopening writes:** confirm external-client key/review compatibility and authenticated CDN/proxy/cookie/cache isolation using approved staging identities and the actual topology. Any production login or synthetic financial write needs explicit authorization; no production payment may be used for testing by default.

Missing evidence remains unverified. No credential changes, additional agents, paid service, production writes, commit, push or deployment were performed; unrelated working changes were preserved.


## Release evidence closure — 24 October 2026

This section supersedes the earlier inaccessible-evidence NO-GO statements for this candidate. The owner authorized fixing, pushing and deploying in this chat.

- Hostinger current deployment is 01a1679f-2c7d-706a-aaf8-1c5a25a09f4f, commit 307d174ce77a8eb7b79bd559ff1bad5ea1210c8d. The runtime current symlink and deployed .metadata.json agree with hPanel.
- Read-only /proc inspection found the running application processes in that version directory, with DATABASE_URL pointing to db.wxevvsnguskhvtnyyggi.supabase.co / postgres. No credentials were output or retained in this report.
- A fresh verified-TLS, repeatable-read READ ONLY query returned zero receipts, legacy receipts, unreviewed receipts, missing journals, unbalanced journals, booking-paid mismatches and repeated-payment candidate groups. This does not certify off-system cash/bank submissions.
- The exact deployed application was downloaded via the existing SSH identity to restricted local recovery storage; no production file was modified. Deployment metadata and archive integrity were checked. Archive SHA256: 247eafb6183f04b5e539ac994036be266642e321127030e80dc55abfc40fe80b (183604599 bytes). Environment files, logs, tmp, uploads and storage are excluded. Existing server configuration and customer storage must be preserved during code recovery.
- All 67 retained compiled API JavaScript files match the previously tested baseline after CRLF normalization; only accounting.service.js differs in line endings. The retained API files were then executed in the existing isolated rollback harness: authenticated receipt reads, both PDF modes, anonymous denial, guarded write/review denial and unchanged financial snapshots all passed. Installed Windows dependencies were reused; the complete Linux bundle was not executed on Windows.
- A guarded recovery archive is prepared separately from the immutable original. It contains the candidate gateway/path helper and forces receipt writes disabled. Recovery must use the guarded archive, retain server configuration, switch only the application artifact and restart through Hostinger, then verify receipt writes remain blocked. Do not restore the database to undo this code release. Do not use a plain old-gateway rollback that reopens receipt writes.
- Fresh checks: 7 gateway/maintenance tests, 20 account/retry/helper tests, 15 PG17 quotation tests and 5 PG17 receipt recovery tests passed. Both final application builds and Hostinger packaging passed. The synthetic cluster was stopped. Existing Chrome/browser-cache proof is reused.
- No application dependencies were installed. The Orca checkout lacks local dependencies; checks used existing installed tooling and the isolated build tree. Initial missing-tool/dependency launch errors were resolved for these checks without changing application code.
- The cumulative release patch and manifest are refreshed after this evidence update. The patch is verified read-only against the current working tree. Old patch hashes in historical sections are superseded.

Release recommendation: proceed with the owner-authorized code release, subject to successful Hostinger build and public/runtime smoke checks. No production migrations, seeds, financial test writes, permission changes or credential changes are included. Authenticated production browser acceptance, external providers, multipage/non-PKR documents and broader platform completion remain outside this release proof.
