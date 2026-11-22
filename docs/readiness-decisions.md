# Remaining readiness decisions — owner review

Baseline rechecked on 22 November 2026: PR #44 deployed as `67c4d19c1876f78b01f66c32bfd2f8cdeba821bd`; Hostinger deployment `01a1ff19-6758-70a7-b6f7-983d42790eb3` is Completed. Auto-deployment is off. The database has 18 completed migrations. Both full dependency audits pass, including development dependencies at moderate severity. The hardening changes are deployed; the remaining acceptance work does not authorize another deployment, upload activation or policy publication. See [the current acceptance record](readiness-acceptance-20261122.md) and [the recovery/storage runbook](recovery-storage-acceptance.md).

## Offsite recovery proposal

The production-schema restore and separate encrypted financial/object drill already establish local recovery. The connected Drive search found no matching backup documents/folders using the existing archive/project names and backup terms. That search's supported MIME-type scope excludes arbitrary binary archives; it is not proof that no remote `.age` copy exists. No approved destination, remote artifact identifier or independent custodian was established. No archive/key was uploaded or shared.

Proposed starting policy, subject to owner approval:

* Use an owner-controlled private offsite folder or object bucket, in a different failure domain from the Windows recovery machine. Record its exact provider/account/folder identifier and permitted readers. Do not make a public link.
* Encrypt the database dump and paired document manifest/bytes locally. Upload only ciphertext plus checksum and aggregate inventory. Keep recovery identities out of that location.
* Target a provisional recovery point of 24 hours and recovery time of eight hours; retain 30 daily and 12 monthly snapshots. These are proposed operational targets, not current guarantees or legal retention requirements.
* Nominate one primary operator and a separately named recovery custodian. Establish offline key custody and a procedure for temporary access during a drill. Do not distribute the existing key until the owner approves recipients and method.
* Quarterly: retrieve the remote ciphertext, verify its hash, decrypt using independently held material and restore to isolated PostgreSQL 17/UTC. Compare migrations, foreign keys, exact ledger/receipt fingerprints and object reconciliation. Record elapsed time and failures using aggregate evidence.

Owner decisions: exact offsite destination/artifact access; named custodian and approved key-transfer method; recovery targets and retention; budget if a new paid resource is needed. Existing local ciphertext alone does not complete this leg.

## Private storage activation review

Only the production Supabase project `zat-erp` was returned by connected-project discovery. No approved hosted staging storage project was established. Do not create a paid project or run storage writes against production to fill this gap.

Read-only production metadata confirms `zat-private-documents` exists and is private, with an 8 MiB limit and PDF/JPEG/PNG/WebP/plain-text MIME types. `storage.objects` has RLS enabled and zero policies, and this bucket has zero objects. This is configuration/inventory evidence, not a real authenticated write/download/restore exercise or proof of hosted durability. No policy or bucket setting was changed.

The local HTTP adapter test uses a loopback private object service with synthetic credentials and disk-backed bytes. It exercises real adapter requests, authenticated access, anonymous denial, branch denial before object reads, public-bucket rejection, connection failure, restart, missing bytes, metadata retention and paired restoration. This is not a real Supabase service or proof of hosted durability/RLS correctness.

A separate production activation change must include all of the following evidence before changing `DOCUMENT_UPLOADS_ENABLED`:

1. Owner identifies an approved isolated hosted Supabase/storage target and test access. Preserve production settings.
2. Verify private-bucket configuration; anonymous/customer direct object access denied; application service credentials remain server-only. Test staff document permissions and cross-branch ownership through the application.
3. Upload synthetic content, restart the hosted application and retrieve identical bytes. Exercise missing object, object-service outage, backup/export and restoration. Reconcile the database and object inventory without deleting unknown objects automatically.
4. Review the backup schedule, monitoring/cleanup ownership, metadata-write uncertainty handling, retention and recovery targets.
5. Prepare a reviewed activation diff/runbook with exact bucket/project, existing application version, verification steps and a disable-uploads rollback. Obtain explicit production activation approval. A successful local drill does not authorize flipping the flag.

## Service and financial decisions

Preserve existing transactional logic. Ticket refunds currently create customer credit; that does not establish a cash payout. Posted Umrah cancellation is held for accounting review. Owner/accountant approval is needed for service-specific fees, supplier recovery/settlement, cash payout authority, currency/tax treatment and closed-period handling.

Transport has a creation/voucher/accounting workflow but no agreed dispatch/completion/refund lifecycle in this review. Visa generic status updates and APPROVED→Completed projection are existing software behavior, not an externally approved visa transition policy. Owner must define permitted transitions and customer wording; supplier/GDS/Nusuk acceptance needs approved sandbox access.

## Customer self-service proposal

Keep the current read-only profile until scope is approved. Proposed first increment: display-name/phone edits with validation and audit; email changes require verification of the new address and session handling. Inquiry history should use an explicit verified ownership link, not a user-supplied email selector. Owner selects editable fields, identity checks, notification behavior and whether inquiry history is required.

## Monitoring and quality proposal

The application health route checks database connectivity and returns 503 on failure. Independent external alert delivery/ownership is not established. Proposed staging acceptance: poll public availability and health every five minutes, alert after two consecutive failures, send a recovery notice and exercise a controlled staging database failure. Owner approves provider, recipients, escalation and maintenance windows before enabling notifications or buying a service.

A manual local drill actually stopped and restarted only the disposable PostgreSQL 17/UTC cluster. The real Nest health endpoint changed from 200 with database true, to 503 with database false, and back to 200 after restart. Response bodies did not expose database errors. This verifies local detection/recovery; no external alert was sent or delivery tested.

Define target devices/data volumes and performance objectives before adding performance gates. Record controlled local navigation timings as baseline evidence only; do not label them production availability or latency guarantees. Continue customer/public keyboard, accessibility and extreme-content PDF coverage. Required languages/fonts and supported currencies need owner confirmation.

## Policy approval packet

Live HTTPS reads in the prior review showed placeholders on `/privacy`, `/terms` and `/refund-policy` (all 200). Owner-review drafts are retained in `docs/policy-owner-review.md`; no policy was published.

Required decisions: confirm business identity/contact; actual collected fields and supplier disclosures; retention/deletion by record type; processors/locations/cookies/marketing; the customer acceptance and business confirmation that form a booking; service-specific changes/no-show/partial-use/refund terms; credit versus payout and payee checks; complaints/rights handling and jurisdiction; final wording and effective date. No fee, refund deadline, legal right or legal obligation is invented here.
