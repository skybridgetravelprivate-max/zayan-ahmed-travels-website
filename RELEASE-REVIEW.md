# Zayan Ahmed Travels release review — 2026-10-24

This is a cumulative, uncommitted release candidate against Git base `307d174ce77a8eb7b79bd559ff1bad5ea1210c8d`. Earlier quotation/accounting/document validation in `QUOTATION-VALIDATION.md` was reused. No full audit, production access, additional agent, commit, push or deployment was performed.

## Receipt recovery contract

- Every new receipt requires a valid `Idempotency-Key`. Replaying the same key and payload returns the same persisted receipt; a conflicting payload returns 409. Keys remain scoped to the submitting staff user.
- Receipt creation also locks the customer payment scope (or branch scope for unallocated receipts). A fresh key, another tab, deleted browser storage, or another staff user cannot bypass an existing unreviewed keyed receipt in that scope. The response is 409 and no financial writes occur.
- An authorized finance administrator must explicitly review the saved receipt before starting a different payment. The review is recorded as the immutable `REVIEW_RECEIPT` audit event, using the same durable-audit proof pattern as verified customer links. Review is idempotent and its failure rolls back. Replaying the original key still returns the original receipt after review.
- `GET /api/v1/finance/receipts/submission/:key` recovers the submitting user's saved receipt and uses `Cache-Control: private, no-store`. `POST /api/v1/finance/receipts/:id/review` requires `{ "reviewed": true }`. Both retain the existing super-admin finance authorization boundary.
- Browser recovery uses staff-scoped **local storage**, not session storage. It retains only a SHA-256 payload fingerprint and retry key. Web Locks serialize key allocation across tabs. Receipt fields/passwords are not stored there. The key remains after a successful response until the saved receipt is explicitly reviewed. Browser storage/coordination failures block submission; there is no unsafe fresh-key fallback.
- Receipt history now displays receipt numbers, and the review summary formats amounts to two decimal places.

There is no schema migration. Existing receipts, quotations, journals and balances are not rewritten. Historical receipts without the `request_` submission identity are not retroactively assigned idempotency keys or review state; unresolved legacy submissions must be reconciled at cutover.

## Final targeted proof

| Check | Result |
| --- | --- |
| New PG17 receipt recovery file | 5 passed, including its parent test |
| Affected quotation journey | 13 passed, including its parent test |
| Existing security-audit file | 19 passed |
| Receipt retry helper | 3 passed |
| Staff-management helper | 2 passed |
| Changed-file ESLint | 0 errors, 0 warnings |
| API build | Passed |
| Website build | Passed, Next.js 16.3.8 |
| Actual browser | Chrome 155.0.8059.84, isolated temporary profile, passed |
| Local reverse proxy | Real loopback HTTP forwarding ahead of real Next/Nest handlers; cookies, retry headers, private PDF/recovery headers and origin enforcement checked |

The browser tests use two tabs to submit the same payment simultaneously. One committed response is deliberately dropped. The test then reloads the page, closes the entire browser, reopens its isolated profile, and retries. Exactly **one** browser payment of **100.10** is added to the earlier HTTP receipt of **250.25**. Final paid is **350.35**, booking net **1010.00**, and balance **659.65**. Fresh/missing-key bypass attempts are rejected, while an explicit saved-receipt review allows an intentional new payment.

Real customer form logins exercise undated booking rendering and account isolation. The owner sees **Date to be confirmed**. Staff document links return private PDFs; customer and foreign staff voucher requests return 401/404. No authentication or accounting service is mocked. The final browser harness also checks two independently verified customer accounts and forged identity selectors.

The test runner creates only synthetic PG17 fixtures and binds all application/proxy listeners to loopback. It uses installed Chrome and a free Playwright package under Temp; no runtime dependency was added to the application. Browser profiles contain synthetic test credentials only and are excluded from the release diff. The harness shuts down its browsers and HTTP services. PG17 is stopped after validation.

## Release artifacts

`release/zat-release.patch` contains the cumulative tracked/untracked source, tests and review documentation changes against the base above, preserving earlier work. `release/manifest.json` lists those files with hashes and the patch hash. Generated profiles, environment files, database data, runtime build output, logs and credentials are excluded. Do not apply or reverse this patch over the active working tree; review/apply it only in a clean isolated checkout of the recorded base.

## Rollback procedure — preparation only

1. Before an authorized release, retain the currently deployed application bundle and configuration through the existing release mechanism. No production backup or release action was performed here.
2. If rollback is needed, first put receipt **POST** operations into write maintenance at the existing gateway/proxy and verify that the receipt-create endpoint returns 503. Preserve read-only history and PDFs where possible. This avoids reopening the old duplicate-payment path during rollback.
3. Revert the application bundle through that mechanism. Prefer retaining the tested guarded receipt API if only the website is rolled back. An older website/client may not understand the review checkpoint, so leave receipt writes blocked until compatible clients are restored.
4. Do **not** restore old database snapshots, remove receipt rows, reset sequences, delete `REVIEW_RECEIPT` events, or reverse financial journals as part of code rollback. No database migration needs reversing.
5. Reconcile every uncertain submission against its saved receipt/journal. Restore the tested compatible client/API combination and validate key replay, review, permissions and balances in synthetic staging before reopening receipt writes.

## Remaining release blockers / production-only checks

- Confirm external receipt clients send and reuse keys, and understand the explicit review checkpoint. Unkeyed clients now fail closed with 400. Resolve any uncertain legacy/unkeyed payments before cutover; no production financial reconciliation was attempted.
- Production Apache/Passenger/CDN behavior, TLS termination, secure-cookie/domain settings, trusted forwarding headers and live cache configuration remain pending. The local HTTP reverse proxy is evidence for forwarding behavior, not certification of the production topology.
- Only current Chrome was driven. Other supported browser engines/client policies must provide local storage and Web Locks; unsupported storage/coordination fails closed.
- Earlier SMTP/WhatsApp delivery, multipage document-layout and non-PKR validation limits remain outside this targeted release proof.
