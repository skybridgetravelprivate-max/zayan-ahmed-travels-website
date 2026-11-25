# Ticket refund safety — review release

This change addresses the three reproduced ticketing audit defects. It does not change refund fees, supplier settlement, cash payouts or global finance access.

## API and retry contract

`POST /api/v1/workflows/tickets/:id/refund` now requires an `Idempotency-Key` of 8–100 letters, digits, underscores or hyphens. Keep the same key and original details after a timeout or lost response. A UUID is suitable. Amounts accept exact decimal strings (preferred) or compatible numbers, with the existing scale/range checks; arrays, objects, negative amounts and sub-cent values are rejected.

The stored refund ID is derived from the operation, authenticated staff ID, ticket ID and submission key. The existing ticket row lock serializes submissions. Current branch, linked-owner and currency checks run before any replay. A matching saved refund returns without another journal, audit or balance change; changed amounts/deductions/reason under the same key return 409. A separately authorized partial refund uses a new key. Replaying the final refund still returns its original result after the ticket becomes refunded.

The staff form retains a fingerprint and key in browser storage, never the refund fields. Browser locks coordinate keys across tabs. Uncertain outcomes retain the key; retry with the original details to retrieve the saved result. A confirmed response shows the saved refund, net credit and record link. The operator must explicitly review that result before clearing the key to start another partial refund. Do not clear browser storage as an uncertain-outcome workaround.

Clients that previously omitted the key must be updated with this release; missing/invalid keys return 400 before financial writes. This is intentional fail-closed behavior. No Prisma migration or production data repair is required: the change uses the existing refund primary key and audit transaction.

## Initial ticket payments

Scoped ticket creators see unpaid issuance fields only, with instructions to ask a Super Admin to record payment. Super Admins retain the existing initial-payment form. The backend finance guard, mandatory receipt key, receipt-review requirements and production upload flag remain unchanged.

## Regression scope

Disposable PostgreSQL coverage includes decimal-string refunds, same-key concurrent/repeated requests, mismatched-payload conflicts, missing keys, malformed money, cross-branch replay denial, final-refund replay, successive intentional partial refunds, exact customer credit and balanced journals. Existing rollback, reissue, customer projection and private PDF checks remain required. Browser-storage tests cover reload, changed payloads, separate tickets and explicit review; workflow tests verify role-specific initial-payment fields without mutating the shared definition.

This document describes a review candidate. Commit-specific CI, local execution evidence and any deployment authorization must be checked separately. No production refund or ticket write is part of verification.
