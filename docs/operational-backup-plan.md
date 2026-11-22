# Operational paired backup plan — approval required

Prepared 22 November 2026. Status: manual drill verified; recurring execution, expanded offsite uploads, retention deletion and alerts are not activated. Proposed 24-hour recovery point/eight-hour recovery time and 30 daily/12 monthly retention remain owner decisions, not guarantees.

## Inventory and current coverage

| Component | Current evidence | Operational requirement / omission |
| --- | --- | --- |
| Public application database | Approved pre-release ciphertext retrieved from private Drive and restored; reviewed additive migrations reached 18. | Snapshot predates later writes. Need an accepted recurring capture, not reuse of the old snapshot as a current backup. |
| Populated financial records | Fresh encrypted synthetic paired drill on current 18-migration schema: 18 journals, six receipts, exact balanced 1040.00 debit/credit, same financial fingerprint. | Synthetic local evidence; no populated production financial restore is claimed. |
| Stored-document metadata/bytes | Real isolated hosted-object restoration passed with local Nest/PostgreSQL fixtures; current production metadata/object inventory was zero. | Future accepted production snapshots must pair metadata and exact bytes. Empty inventory must be recorded, not assumed forever. |
| Other platform schemas | Read-only production inventory confirms auth, storage, realtime and vault alongside public. | Public-schema dump does not cover these. Review provider-supported recovery/export and required roles/grants separately; do not copy secrets through ad hoc SQL. |
| Application artifact | Previously verified release/rollback artifact evidence retained. | Keep exact SHA, lockfiles, build/runtime version and recoverable artifact with a separate integrity record. Reverify before using it. |
| Configuration, SMTP, DNS, mailbox, suppliers | Existing runtime inventory identifies dependencies. | Not contained in the database/object archive. Approve a separately protected inventory/recovery process; do not upload credentials or private keys under existing Drive approval. |

## Pair capture protocol

1. Privately verify approved source project/database/bucket and application revision. Use verified TLS, server-side credentials and owner-restricted temporary storage. Do not print connection strings, object contents or private identities. Never substitute test credentials or use a restore target as source.
2. Establish an accepted consistency cut. An approved maintenance window blocking document mutations is one option; no flag/restart is authorized here. Alternatively demonstrate immutability/version/retention protection that prevents snapshot-referenced bytes disappearing during capture. Do not assume a provider's versioning exists. Without either protection, fail acceptance on missing/changed bytes and retain the previous valid backup.
3. Open a repeatable-read, read-only PostgreSQL transaction and export its snapshot. Keep it alive until `pg_dump` completes using that snapshot. Capture the document metadata/reference inventory from the same cut. Use environment-based connection settings and `pg_dump --format=custom --schema=public --no-owner --no-acl --snapshot=<exported snapshot>`; never put a password-bearing URL in arguments/logs.
4. Export exactly the snapshot-referenced objects through the supported private storage API. Record key, byte length, SHA256 and metadata linkage in the private manifest. Validate project/bucket/prefix and safe local paths. Compare before/after metadata and byte fingerprints when relevant; a database snapshot alone does not freeze object storage.
5. Reconcile metadata and object inventory. Missing or changed referenced bytes make the pair incomplete; quarantine it. Report unreferenced objects with cut-time/in-flight context and retain them for review. Do not automatically delete unknown objects or classify every post-cut upload as an orphan.
6. Package the dump, paired bytes, private manifest and integrity records into a fresh staging archive. Encrypt locally to the approved public age recipient. The routine backup job needs the public recipient, not the private recovery identity. Keep private identities offline/separately held; do not install them on the production runtime to automate backups.
7. Verify ciphertext SHA256 and archive completeness. A custodian-approved isolated decrypt/restore verifies recoverability; hashing ciphertext alone does not prove it can be decrypted. Never publish a partial archive as the latest accepted backup.
8. Offsite upload is a separate authorized step. Current approval covers only the retained pre-release ciphertext and scope/checksum manifest. Obtain explicit expansion approval before uploading new snapshots, document packages or configuration. Upload ciphertext and aggregate inventory only to the exact approved private destination. Read back owner/sharing state, retrieve independently and compare SHA256. Do not make a public link or store the identity beside ciphertext.
9. Record accepted snapshot time, schema/migration count, artifact version, ciphertext hash, paired-object counts, validation time and destination receipt in an owner-restricted ledger. Commit only sanitized aggregate evidence to source control.

## Proposed disabled schedule and failure handling

- Proposal: one daily consistent pair and a quarterly independent restore, plus a manually authorized pre-release pair when required. Activation needs owner/operator, accepted UTC window, retention, destination expansion and monitoring decisions. No scheduler/automation is created by this document.
- Preserve the last verified pair until a replacement passes capture, encryption, retrieval and restore gates. Treat partial pairs separately; do not advance last-success time on an upload-only result.
- Proposed alert conditions: failed run, last accepted snapshot exceeding approved RPO, missing/mismatched objects, checksum failure, permission drift, insufficient disk/quota or failed restore. Choose recipients/escalation/maintenance handling before sending any alert. Logs contain stage/error codes and aggregate counts only.
- Do not retry an uncertain upload by blindly replacing its remote object. Read back the run identity/hash first. Use unique run identifiers and a single-run lock. A repeated verification may reuse the same artifact; it is not another recovery point.
- Retention pruning stays disabled until policy and exclusions/legal holds are approved. Do not delete the only recoverable pair, unresolved objects or keys. Stop and report storage/budget limits rather than creating paid resources or silently dropping history.

## Repeatable isolated populated financial/object drill

Use existing `backend/scripts/financial-restore-journey.cjs` and `docs/public-schema-restore.md`. The script accepts only loopback PostgreSQL 17 fixture targets, a fresh `zat_restore_financial_*` destination and a fresh output directory. Seed `zat_synthetic_payment_integration` using `payment-integration.pg17.spec.ts` after applying current migrations. Start the cluster with UTC explicitly; stop it afterward. Keep existing synthetic-only guards intact.

The new 22 November run matched 104 public tables/169 synthetic rows, 178 validated foreign keys/zero orphans and 18 completed migrations. It preserved 18 journals, six receipts, the financial fingerprint and exact debit/credit totals of 1040.00. One paired document had zero missing/orphan objects, authorized download, foreign-branch denial and matching fresh-process hash. Ciphertext SHA256: `4a7b88386b0614c4d0242c8b52b456c5093cc3b4cc8dba996c291734b8f892eb`. Output/evidence stay owner-restricted outside the repository. No new archive was uploaded; no independent custodian or hosted runtime-role recovery is implied.

## Restore and authority boundary

Retrieve an approved artifact, verify its independent expected checksum, obtain custodian-approved offline decryption access and restore only into fresh isolated PostgreSQL 17/UTC and an approved private test object target. Compare snapshot migration history before applying newer reviewed migrations; verify tables, foreign keys, exact financial fingerprints, object hashes and application reads/access denial. Test replacement hosted roles/RLS separately. Record full retrieval-to-acceptance elapsed time, including failures; do not promote a successful-attempt time to a recovery guarantee.

Production restoration is a separate incident/owner decision with write-preservation and reconciliation planning. Application rollback does not authorize database rollback, object deletion, financial reversal or loss of new writes.
