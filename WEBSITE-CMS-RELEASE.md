# Website CMS release candidate — 28 October 2026

This candidate requires migration `20261028120000_website_editorial_revisions` (14 total). It is local-only. Production migration, permission changes, pushing and deployment require separate approval.

## Contracts and operation

- Preserve Next.js/NestJS/PostgreSQL and existing session, finance and document services.
- `/admin/website` requires `cms.view`; edits require `cms.edit`; publishing requires `cms.publish` or the existing super-admin role. This release does not provision roles.
- Save → private preview → review → publish. Every change has an immutable revision and transactional audit. Stale versions return 409. Restoring a revision creates a draft, requiring review/publish again.
- Public reads use published snapshots and no-store responses. No shared public content cache needs invalidating. Older published content remains visible while a newer draft is edited.
- Legacy admin CMS writes and generic resource writes are blocked. External callers must adopt `/v1/website/pages` editorial endpoints; inventory callers before production approval.
- CMS media reuses private document storage; only CMS-owned validated images can register. Bounded WebP re-encoding strips metadata. Published references alone authorize public image reads. Draft/history references prevent removal. Removal retains the underlying private object.
- Keep `DOCUMENT_UPLOADS_ENABLED=false` in production. Cloud object persistence, access policy and independent recovery require separate acceptance before upload activation.
- `GATEWAY_HOST` is optional: `127.0.0.1` for isolated packaged gateway tests, `0.0.0.0` by default for existing hosting. No public binding is needed for local tests.
- Unsafe legacy physical travel deletion/bulk repricing are held for reviewed workflows; Umrah state transitions delegate to the established lifecycle and cancellation hold. No refund payout policy is invented.

## Production gate and rollback

1. Recheck exact deployed commit/database binding and candidate diff. The latest verified baseline is `2a596fe7e658d1a58f7c2634b7a242ce76eea024`.
2. Obtain specific approval for a fresh encrypted current recovery snapshot and isolated PG17 recovery proof; existing historical snapshots do not establish current recovery.
3. Retain the exact current application artifact and test a guarded rollback. A retained older `2966b1e` artifact is not proof of recoverability of the current baseline.
4. Review invalid legacy CMS lengths/status and privileges; migration aborts invalid content instead of truncating. Confirm runtime DB role can access editorial tables after RLS/revokes. Approve migration/security changes explicitly.
5. With approved maintenance, apply migration once using established Prisma deployment. No seeds, historical payment changes, credential changes or role provisioning.
6. Deploy the exact separately approved candidate and verify Hostinger commit, migration count, TLS, health, database connectivity, authentication denial/private cache headers and published/draft isolation. Do not create production financial tests.
7. On failure, close writes using the approved maintenance mechanism; restore the verified guarded application bundle. Leave the additive schema in place. Never restore a database snapshot to undo code or lose payments. Editorial revision restoration returns to draft, not immediate publication.

## Local proof

Commands and exact results are recorded in the workspace `outputs/fullstack-final-checks-2026-10-28.json`. Synthetic PG17 tests cover CMS concurrency/audit rollback/private media, legacy admin scope/lifecycle and existing financial workflows. `website-cms-upgrade-check.cjs` verifies an isolated 13→14 upgrade. `website-cms-journey.cjs` exercises the packaged gateway with Chrome. Tests never need production credentials.

Exact approved original logo/photography is still required to reproduce the mockup artwork. Existing monogram and original local illustration avoid fabricated assets/inventory/reviews. Provider APIs, message delivery, refund disbursement policy and independent monitoring remain separate dependencies.
