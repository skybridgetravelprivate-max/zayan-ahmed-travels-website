# Isolated runtime and upload activation — review packet

Prepared 22 November 2026. No runtime was provisioned/deployed, no production flag changed and no paid resource created. The only accepted quote is $0/month for isolated Supabase project `zat-storage-acceptance`; it is not a quote for application hosting.

## Target and cost gate

No approved isolated hosted application identifier is recorded in the repository. Hostinger discovery was not completed because browser control could not reliably verify the URL. Do not infer another business's tab/domain is an approved target, call production a staging environment, or assume spare plan capacity is free.

Proposed target: a dedicated, separately configured Node 22 application in an owner-approved hosting account, backed by isolated Supabase `joptpiauirpqlkvoishp` and its private `zat-storage-acceptance` bucket. Record exact app/project/root/hostname, provider/plan, private access, restart mechanism, artifact retention and rollback route before deployment. Application compute, storage, egress, domain/TLS and backup capacity must have an actual provider/account quote. Incremental application cost is **unquoted**, not $0; spending approval remains required before any paid resource.

The test Supabase server key is already configured privately; no need to ask for it again. A hosted Nest runtime also needs an approved isolated database connection with verified TLS/CA and migration access. Do not substitute the production DATABASE_URL or reset credentials to avoid missing access. Confirm the new project's database connection privately through its normal provider controls.

## Deployment plan after separate authorization

1. Owner identifies the exact isolated target and accepts the actual quote. Obtain explicit approval to deploy the exact CI-passing revision there; this review prompt prohibits new deployment. Keep production and staging auto-deployment off while preparing.
2. Match branch/head/source tree, lockfiles, required CI and a recoverable prior staging artifact. Build with the repository's established commands and Node 22; retain the Hostinger packaging check. Record the exact artifact/SHA and runtime entry point. Do not improvise a second API or seed in application startup.
3. Use a separate application/configuration root outside production's hbuild/config/ancestor environment chain. The launcher reads ancestor environment files, so a subfolder under production is not adequate isolation. Verify no production DB URL, JWT secret, internal token, SMTP credential, bucket or local restore identity is inherited.
4. Configure isolated DATABASE_URL/CA, distinct JWT secrets/internal token, approved staging SITE_URL/APP_URL/CRM_API_URL and server-only isolated storage URL/key/bucket. Use private SMTP capture and disabled external-provider sends; do not send real email/messages. Apply reviewed migrations only to the approved isolated DB with target/history checks. Seed synthetic records explicitly, never production records.
5. Enable uploads only in this isolated runtime; production stays false. Restrict staging access, prevent public indexing and verify no server secret appears in client bundles, responses or logs. Use existing authenticated document routes and branch/linked-owner logic; do not add permissive storage policies.
6. Run real hosted application HTTP/browser checks: health, staff/customer login, upload/hash/download, anonymous/customer direct denial, foreign-branch denial, process restart and fresh-process hash retrieval. Exercise missing object and application-side connection failure on designated synthetic fixtures only. Provider restart/durability remains a separate claim unless actually tested.
7. Verify paired metadata/object backup/restoration and non-destructive reconciliation. Retain exact artifact/environment identities, private logs, aggregate results and cleanup evidence; remove only known disposable fixtures. Do not delete unknown objects automatically.
8. Review failure/startup/rollback behavior and alert delivery using approved recipients. Stop at any failed required check. No production activation follows automatically from a passing staging run.

## Production upload activation change — not authorized

Last verified production application: `67c4d19c1876f78b01f66c32bfd2f8cdeba821bd`, Hostinger deployment `01a1ff19-6758-70a7-b6f7-983d42790eb3`. These are historical identifiers: privately reverify current deployment/settings/rollback at action time. Production project is `wxevvsnguskhvtnyyggi`, private bucket `zat-private-documents`; do not replace them with the staging target. Current read-only inventory showed 18 completed migrations and zero document metadata/object rows; emptiness is not storage acceptance.

Before requesting activation approval, attach passed hosted runtime evidence, production private-bucket/role review, accepted paired backup/offsite recovery scope, retention/monitoring ownership, independent custody status and rollback readiness. Record any remaining exception explicitly; do not call the platform complete.

The proposed activation is a separately reviewed environment change: `STORAGE_DRIVER=supabase`, correct production private URL/key/bucket, then `DOCUMENT_UPLOADS_ENABLED=true` only after explicit approval and the planned restart. No migration is assumed; recheck the exact release diff/history before deciding. Never copy the test project's key into production. Keep auto-deployment off and verify it after any settings save, because Hostinger has re-enabled it during prior redeploys.

Use only approved synthetic production accounts and a controlled document fixture for authorized smoke tests after separate approval. Check public health/home/recovery routes, staff upload/private download/hash, anonymous/customer/foreign-branch denial and persistence across the approved runtime restart. Do not create production journal entries or send to real recipients.

Disable-uploads rollback: set `DOCUMENT_UPLOADS_ENABLED=false` and restart through the approved runtime mechanism; verify new uploads return the expected unavailable response while existing authorized downloads remain. Preserve metadata, object bytes, new writes and unresolved outcomes. Do not drop tables, restore an old DB, delete objects, make a bucket public or automatically redeploy old code as a substitute. Any application rollback requires its separately verified artifact and write-quarantine plan.

## Owner action packet

Provide/select the exact isolated hosted application target and actual quote, then separately authorize its test deployment. Nominate primary backup operator and independent human custodian; approve retention/schedule/recovery objectives and monitoring recipients/escalation. Explicitly approve any expanded Drive uploads. The existing approval covers only the earlier pre-release ciphertext/manifest. No key distribution, recurring job, alert subscription, policy publication or production activation is authorized by this packet.
