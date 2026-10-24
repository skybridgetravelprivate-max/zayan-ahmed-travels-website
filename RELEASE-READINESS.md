# Read-only release readiness — 2026-10-24

Recommendation: **HOLD receipt-write release** until legacy uncertainty, external-client compatibility and rollback controls are verified. No new candidate code defect was confirmed in this review. Do not remove the mandatory key or pending-review guard to make older clients work.

## Artifact and reused proof

Reviewed `RELEASE-REVIEW.md`, `QUOTATION-VALIDATION.md`, the actual receipt/server/UI patch hunks and caller implementations. All 30 manifest file hashes match. Patch size is 141854 bytes; SHA256 is `b8b3f437797bef67adf58b07e65acff0159bf510d7908b8ab2ed5177fc3fdfbb`. `git apply --reverse --check release/zat-release.patch` passes without applying anything.

Reused completed evidence: 42 reported targeted tests, API and website builds passed, changed-file lint clean, actual Chrome/PG17/local-proxy journey passed. This review did not rerun those tests or builds. Those results include lost-response recovery, simultaneous tabs, reload, complete browser closure/reopen, review, totals, authorization, undated bookings, PDFs and customer isolation. Local totals remain net 1010.00, paid 350.35, balance 659.65. No production write or authenticated production journey was performed.

## Receipt callers and compatibility

| Caller / entry | Assessment |
| --- | --- |
| `src/lib/staff-workflows.ts:46` → `src/components/admin/ManagementWorkspace.tsx:209` | Only active application receipt-create UI found. Request wrapper sends `Idempotency-Key`; local storage persists it by staff identity; Web Locks coordinate tabs; changed details/storage failures fail closed. |
| `ManagementWorkspace.tsx:170,228,231` | Recovery GET and explicit review POST are implemented. Key is retained after success and cleared only after server review and matching receipt lookup. History offers review after local storage loss. |
| `backend/packages/config/src/entities.ts:702` | Legacy descriptive path `/finance/receipts`; no runtime consumer of ENTITIES/entityByKey/entityByPath found beyond their definitions/re-export. It is not an additional active HTTP caller in this tree. Any external consumer remains unverified. |
| Generic `/api/v1/resources/receipts` | Read/history path. `resources.service.ts:59` rejects create/edit/delete, including for super administrators; it cannot bypass the transactional endpoint. |
| `backend/scripts/quotation-http-journey.cjs:119–127` | Synthetic create/replay/conflict requests supply keys. Unkeyed outsider request is an intentional denial assertion. |
| `backend/scripts/receipt-browser-checks.cjs:44–134` | Drives the real UI; direct fresh/missing-key, untrusted-origin and foreign-review calls intentionally assert rejection. Recovery GET also tested. |
| `backend/apps/api/src/finance/receipt-recovery.pg17.spec.ts` | Direct controller tests supply keys, with deliberate missing-key/new-key failures; review/restart/concurrency included. |
| `backend/apps/api/src/crm/quotation-journey.pg17.spec.ts:127–154` | Direct controller keyed replay, payload conflict, denial and rollback tests; intentional subsequent payments explicitly review first. |
| `backend/apps/api/src/common/security-audit.spec.ts:117,138,168` | Direct controller unit callers pass keys. |
| `finance.controller.ts:136,138` → `AccountingService.postReceipt` | Only production receipt insert and accounting-post caller found. Both occur within the same locked transaction. No other receipt create/createMany writer or import/seed receipt caller found in repository search. |
| Deployed older frontend, integrations, scripts outside this repository | Not certified. Missing keys now return 400; new keys cannot bypass unreviewed keyed payments (409). Must adopt stable keys, uncertain-outcome recovery and explicit review before enabling writes. |

Finance creation, recovery and review remain restricted by JWT, permission and super-admin finance guards. Same staff/key with changed payload conflicts; same payload replays. Customer/unallocated-branch scope locking prevents another staff identity or newly generated key bypassing an unreviewed keyed payment. Review records an audit event; it does not alter financial rows.

## Legacy uncertainty — assessment boundary

Confirmed code limitation: pending protection selects IDs beginning `request_` only. Historical unkeyed receipts are not covered. A lost response from the old application retried under a new key after cutover can therefore become another payment if no keyed pending receipt blocks that scope. This is a cutover blocker where legacy outcomes are uncertain, not evidence that any particular payment is duplicated.

No authorized production read-only database connection or aggregate report was established in this review. Production counts, duplicate candidates and journal/balance consistency are **unknown**. A local backup directory listing was denied by filesystem permissions; no backup contents or credentials were read. Connected unrelated database services were not assumed to belong to this application.

Before enabling writes, an authorized operator must assess uncertain submissions against receipt/journal/bank evidence using a read-only transaction and aggregate-only reporting. Needed checks: legacy versus keyed receipt counts, unreviewed keyed counts, missing receipt journals, unbalanced posted journals, booking paid versus linked-receipt totals, and repeated same-scope/amount/method/date candidates. Candidate similarity alone must never trigger reconciliation, deletion, review or financial rewriting. No such operations were performed.

## Production observations possible now

Anonymous GET probes on 2026-10-24, with normal certificate verification enabled, returned:

| Request | Result |
| --- | --- |
| HTTP apex and www `/` | 301 to the corresponding HTTPS hostname |
| HTTPS apex and www `/` | 200; TLS 1.3; certificate authorized for both names, issuer YE2, expires 2027-01-16 09:47:14 GMT |
| HTTPS www `/account` | 200; private, no-cache, no-store, max-age=0, must-revalidate |
| `/api/account/bookings` | 401; same private/no-store policy |
| `/api/v1/resources/receipts` | 401; no Cache-Control observed |
| `/api/v1/finance/receipts/submission/release_readonly_probe` | 404; no Cache-Control observed; does not prove candidate recovery handler is deployed |
| `/api/health` | 200; response body not inspected |

Responses identify server `hcdn`. No Age, Via, X-Cache, CF-Cache-Status or HSTS header was observed on these requests. These observations demonstrate public TLS/redirect behavior and route-dependent anonymous responses; they do not certify origin topology, absence of CDN caching or authenticated data safety. Missing no-store on current staff denial responses warrants configuration review but is not proof of cached private data. No cookies, secrets or customer response bodies were printed.

## Checks after authorized deployment

Verify actual key forwarding/replay and explicit review through hcdn/Apache/Passenger, authenticated recovery/PDF private-no-store headers and absence of shared-cache reuse across two accounts, secure cookie attributes and domain behavior on both origins, trusted forwarding/Origin handling, and deployed customer isolation/undated booking display. The candidate POST/review checks require controlled synthetic staging or separately authorized writes; anonymous production GETs cannot establish them. Current production read-only TLS checks are complete; candidate deployed behavior remains pending.

## Rollback readiness and release gates

Rollback is **documented, not operationally verified**. No retained deployed bundle/config snapshot was verified. The checked-in gateway's 503 responses cover application startup/unavailability; no receipt-specific write-maintenance switch was found there. An existing external proxy control may provide one, but its existence and operation remain unverified.

Before release, retain the current compatible bundle/config through the established release mechanism and prove a receipt-POST-only 503 maintenance control in staging. During rollback, block receipt writes before loading an older binary; keep the guarded API if rolling back only the frontend. Reopen writes only with compatible clients and resolved uncertain submissions. No schema rollback is required. Never restore a database snapshot, delete receipts/review events, reset sequences or reverse journals as part of this code rollback.

Blocking readiness gaps: legacy uncertainty has not been assessed; external/deployed callers are not inventoried and certified; rollback artifact/maintenance control is not verified. Authenticated candidate behavior through the production edge remains a deployment acceptance gate. Earlier non-PKR, multipage document and messaging-delivery limits remain outside the reused targeted proof.

Only this report was added. Original patch/manifest and accumulated source changes were preserved. No production writes, additional agents, commit, push or deployment occurred.
