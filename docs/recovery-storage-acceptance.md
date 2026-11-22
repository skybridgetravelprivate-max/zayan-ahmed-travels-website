# Recovery and private-storage acceptance

Status: review procedure. The approved Drive ciphertext retrieval and isolated public-schema restore leg passed on 22 November; see [evidence and scope](offsite-recovery-verification-20261122.md). Independent custody, broader recovery coverage and hosted storage acceptance remain incomplete. Production uploads stay disabled. Use this with `public-schema-restore.md`, `readiness-decisions.md` and the dated acceptance record.

## Owner setup packet

Recommended starting configuration:

- One owner-controlled private offsite folder/object location, outside the Windows machine and Hostinger failure domains. Record provider, account, exact folder/bucket identifier, primary operator and permitted readers. Upload ciphertext and checksum/inventory only. An accessible account is not approval of an arbitrary destination.
- One separately named recovery custodian with an approved offline identity copy and temporary-access procedure. Never store the identity beside ciphertext, put it in a repository, or send it in chat. Do not distribute keys without approval.
- Proposed recovery point 24 hours, recovery time eight hours, 30 daily/12 monthly copies and quarterly drills. Owner must approve retention, recovery targets and any cost; these are not current guarantees.
- An existing approved non-production hosted storage project and private bucket, plus an isolated application/database using synthetic records. Do not use the production project for destructive, outage or upload acceptance tests. Do not provision paid resources to bypass missing access.

The owner can delegate technical choices, but an actual independent person, accessible artifact and provisioned isolated environment are still required. Record who owns backup checks, storage monitoring, exception handling and restore acceptance.

## Offsite retrieval and isolated restore

1. Identify approved remote artifact/version, its snapshot time and recorded encrypted checksum. Retain provider retrieval evidence without recording bearer URLs or credentials. Download into a new owner-restricted directory; do not overwrite the retained local backup.
2. Hash the retrieved bytes and compare with the independently retained expected checksum. Stop on mismatch. A local copy matching its local hash does not prove remote retrieval.
3. Have the approved custodian exercise the agreed recovery-access procedure. Decrypt privately with the existing identity. Record custody/access success, never key contents. A same-operator local identity does not establish independent custody.
4. Restore only into a fresh loopback-bound PostgreSQL 17 database with UTC timestamps. Follow `public-schema-restore.md`; explicitly verify version, database name and timezone. Never point restore commands at production, an existing database or a deployment connection string.
5. Match snapshot migration history before applying newer migrations. Compare all archived table/row fingerprints, validate foreign keys, compare exact journal/receipt balances where present and exercise generated application reads. Use paired synthetic financial fixtures when the snapshot lacks financial examples; distinguish that evidence from production-data restoration.
6. Apply only the reviewed additive migrations to this isolated restore when needed for the accepted application version. Verify no unfinished migrations, then exercise reads again. Do not seed a restored customer database.
7. Record retrieval/decryption/restore/verification elapsed times, scope and omissions. Stop the cluster and retain/remove plaintext under the approved private retention process. Never expose restored records in reports.

The public-schema archive excludes storage object bytes, other platform schemas, deployment/configuration/secrets, mailbox/DNS and later writes. Include separately reviewed paired object/configuration recovery coverage before claiming full-platform recovery.

## Isolated hosted document drill

Record exact approved project/bucket and isolated application revision first. Keep service credentials server-side, out of browser bundles and logs. Match the existing adapter contract in `backend/apps/api/src/common/storage.service.ts`; do not add permissive policies solely to make a test pass.

| Exercise | Required evidence |
| --- | --- |
| Target/configuration | Non-production project identity verified; bucket private; approved size/MIME limits; application DB is disposable; upload flag enabled only in this isolated runtime. |
| Upload | Synthetic staff uploads known PDF bytes to a synthetic linked entity. Retain its SHA256 and metadata identity privately. |
| Authorized retrieval | Application download returns identical bytes and private/no-store headers. |
| Denial | Anonymous application access and anonymous/customer direct object access denied; foreign branch/linked-owner requests denied before bytes are read. |
| Restart | Restart only the isolated application; a new process retrieves the original bytes/hash. Restarting an API fixture alone is not proof of hosted durability. |
| Missing object | Remove only the designated disposable object after backing it up; metadata remains; authorized retrieval returns a sanitized unavailable response. |
| Outage | Isolate the test application's object connection; confirm sanitized failure and recovery. Do not interrupt the production bucket/service. |
| Paired backup | Export synthetic metadata plus exact object bytes and a checksummed manifest. Detect corruption before restore. The existing `document-backup.mjs` is synthetic-only; do not remove that restriction to export customer data. |
| Restore | Restore to the approved disposable target; a new process retrieves the same hash and preserves authorized/denied behavior. |
| Reconciliation | Compare all synthetic metadata keys with object inventory; report missing, orphan, duplicate or mismatched entries. Do not automatically delete unknown objects. Empty production inventory is not this drill. |

Use `npm run test:document-backup --prefix backend` for the existing synthetic manifest/restore checks. The `documents/private-storage.pg17.spec.ts` drill is a loopback HTTP fixture; keep its results labeled local and never relabel them hosted Supabase acceptance.

## Separate production activation review

Before activation, assemble hosted results for every row, accepted object backup/recovery evidence, retention/monitoring ownership and a production bucket/configuration review. Prepare an explicit change identifying the verified application revision, project/bucket, flag change, smoke checks and disable-uploads rollback. Obtain separate activation approval. Keep existing reads and metadata intact. Do not publish policies, change financial data or restart production as part of this review procedure.
