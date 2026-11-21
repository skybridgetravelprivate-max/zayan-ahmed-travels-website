# PR #44 release preparation — review only

Application code candidate: `bbd5bb4217f5d2edfea4cbb48eb4e83a6603d458` (recorded after local verification, including the operator recovery workspace). The final documentation-inclusive SHA and exact CI runs belong to the PR #44 release record. Before any release, match local HEAD, remote PR head, reviewed source tree and the successful CI SHA. Do not deploy a moving branch without this comparison.

## Current production evidence

Read-only hPanel inspection on 21 November 2026 shows Current / Completed deployment `01a1f4bc-5ee9-7344-9e2d-2c29fc9f7e3e`, commit `88321c0e301054ec55d08a9cecb0674f714a0030`, branch `cursor/customer-account-bookings`, Node 22. The dashboard explicitly reports auto-deployment off. The deployed artifact exposes a Redeploy action; redeployment/rollback was not exercised in this task.

The previously established PostgreSQL project `wxevvsnguskhvtnyyggi` remains active/healthy on PostgreSQL 17. Read-only migration aggregates show 16 completed, 0 unfinished; neither pending migration below exists in production. Before applying anything, privately match the Hostinger database binding to this approved target again. Never print its credentials or connection string.

HTTPS checks returned homepage 200, health 200, customer forgot/reset pages 200, anonymous audit GET 401 and manual-journal POST 401. No authenticated production financial write or email was used. Production HSTS was absent; this task does not activate it. Uploads, policy content and CSP/HSTS activation remain outside this authorization.

## Migration order and release gates

Two additive Prisma migrations are pending, in this order:

1. `20261121090000_hardening_indexes_outbound`: recent-auth/customer-ticket indexes and private outbound ledger.
2. `20261121110000_communication_retry_safety`: EMAIL/WHATSAPP discriminator (existing rows default to WHATSAPP) and private RLS-enabled communication request claims. No existing Communication, financial or customer record is rewritten.

Both passed fresh disposable PostgreSQL 17/UTC migration and integration runs. No production migration was attempted. The application does not migrate at startup. Review production table sizes/index locks and select an approved maintenance window. Preserve auto-deployment off while preparing and applying migrations.

Only after separate release authorization, a current accepted backup and target/history checks, use the established `npm run db:migrate:deploy --prefix backend` in the approved private production environment. Inspect actual migration completion and absence of unfinished entries before deploying dependent code. Do not run seed, db push, destructive reset or rollback SQL. Keep credentials in the approved environment and outside reports.

Required checks remain both full npm audits including development dependencies at moderate, lint/typechecks, complete suites, production build/packaging and PostgreSQL/SMTP journeys. Keep the exact-parent Prisma/Effect override until a smaller tested parent resolution replaces it; the checked current parent releases still pinned affected Effect. No exception or CI reduction is allowed.

## Backup evidence and limits

Rechecked retained ciphertext hashes:

* Production-schema archive: `7202AB5B0491D1BFB2FABEAFB7EBA89C068C64A1A37748A6A0C26B4428D3F71D`.
* Separate synthetic financial/object drill: `E8D657BC95850AAA139B8A0BE6F85A568D14A2A298B66A9A1D5A7309268BE848`.

These are the retained 19 November artifacts and prior local-restore evidence. The production snapshot predates later writes/migration 16 and excludes objects/other platform schemas. The synthetic archive is not a production-data backup. They are not a fresh complete release backup, nor evidence of independent offsite recovery. Capture/verify a current agreed backup scope before production migration; preserve existing keys privately. Offsite artifact access, approved destination, independent custodian, retention and recovery targets remain owner decisions in `docs/readiness-decisions.md`. No remote archive/key was uploaded or shared here.

## Communication operation and reconciliation

Staff email, CRM lead/customer communication writes (including log-only writes) and quotation sends require an 8–100 character Idempotency-Key. Retain its original payload and key after timeout/restart. Different content, recipient, linked owner or send intent must conflict. New keys are deliberate new submissions, not automatic timeout retries.

Read one's own result with `GET /api/v1/comms/email/submission/:key` or the WhatsApp equivalent. SENT means provider/SMTP acceptance, not recipient delivery. UNCERTAIN blocks the original key and identical ambiguous content. Super Admin/settings authority must independently confirm the result and supply an audited reason to the channel's `POST /api/v1/comms/{email|whatsapp}/:id/reconcile`. NOT_SENT does not reopen an old key; use an explicit new submission only after review. Do not mark NOT_SENT just because a request timed out or while delivery could still be in flight.

The quotation browser retains a saved retry key until acknowledgement. The reviewed `/admin/communications` workspace now provides own-key lookup, Super Admin outcome review and conservative preparation of a new quotation attempt. It loads up to 50 saved quotation attempts for the current staff namespace from this browser (bounded to 10000 inspected storage entries). It never sends a message. Before releasing a saved key, it acquires the existing quotation Web Lock, fetches both channel states again and verifies the stored key still matches. At least one channel must be NOT_SENT and every other channel NOT_SENT or absent. SENT, UNCERTAIN, wholly absent results, corrupt storage, changed keys or unavailable checks keep the key. When one channel was accepted and another was not, do not restart the whole quotation; separately review any targeted remaining-channel operation.

Super Admin review reads minimal metadata by submission identity through the guarded `GET /api/v1/comms/submissions/:id`; the result excludes message/destination/fingerprint. The form requires independently confirmed outcome and reason, then reads back the committed result. After a lost response, read the identity again instead of resubmitting blindly. Provider delivery/status semantics and an approved external sandbox remain acceptance gaps. Password recovery keeps its separate fresh one-use token contract, generic responses, failure invalidation and session revocation; no reset-token plaintext is added to the ledger. No additional migration is introduced by this workspace.

## Deployment, smoke tests and rollback

After explicit authorization and successful migration verification, manually deploy the exact reviewed/CI-tested revision to the existing project. Monitor build/startup to completion, match the deployed commit and check auto-deployment remains off. Do not enable uploads, enforce the stronger report-only CSP, activate HSTS or publish policies as a side effect.

Verify homepage and `/api/health` 200 with `ok=true`/`db=true`; anonymous privileged routes401/403 without data; both recovery pages; private account/cache behavior. Use only approved synthetic accounts and a controlled inbox for authenticated production checks. Successful journal writes belong in staging. Do not use real recipients to probe the communication ledger.

Application rollback target is the currently verified `88321c0e301054ec55d08a9cecb0674f714a0030` / deployment above. Recheck that exact artifact/commit remains recoverable before releasing. Quarantine affected writes before rollback: the older API does not implement the new outbound request ledger. Any external write block must survive bundle replacement and be verified, not assumed. See HOSTINGER-RUNTIME.md for the receipt-write maintenance limitation; its environment flag alone does not protect an older gateway. Do not restore an old database, delete new writes, drop additive tables/indexes or erase unresolved delivery identities. If a durable write quarantine cannot be established, the rollback path has not passed acceptance.

## Remaining owner actions

Review the PR and separately authorize any production migration/merge/manual deployment. Identify the approved offsite destination/artifact and independent key custodian; supply isolated hosted storage and provider sandbox access. Approve the finance/settlement rules, monitoring ownership and policy decisions already itemized in the owner packet. No paid resource, production storage write, policy publication, key distribution or external message is authorized by this preparation.
