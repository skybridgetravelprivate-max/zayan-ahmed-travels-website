# Secure document storage

## Current behavior

- Uploads are disabled unless `DOCUMENT_UPLOADS_ENABLED=true`; the checked-in API example keeps it `false`.
- Production uploads require `STORAGE_DRIVER=supabase`. The local filesystem driver is for development/tests and is rejected for production uploads.
- New Supabase keys use the `supabase/<UTC year>/<random UUID>.<extension>` form. Pre-existing local keys remain readable through the local driver path.
- The API returns file bytes only through the authenticated download route after rechecking `document.view`, the document owner’s view permission, and branch/linked-record scope. Downloads are marked `private, no-store`; it never creates public or signed URLs.
- Upload requires `document.create`, the owner’s view permission, and branch/linked-record scope. Delete requires `document.delete` plus the same owner authorization.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses Storage RLS. The API must retain these application checks on every operation. Never put this key in website/browser variables, logs, or source control.

## Supabase configuration to prepare (not applied)

In the **existing, owner-confirmed Supabase project**, create the bucket `zat-private-documents` with:

- **Public bucket:** off.
- **Maximum object size:** 8,388,608 bytes (8 MiB), matching the API limit exactly.
- **Allowed MIME types:** `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, and `text/plain`.
- Do not add permissive `anon` or `authenticated` object policies. Direct browser access is not part of this design. The server-side secret key bypasses RLS, so API authorization is the enforcement boundary.

Set these values only in the private Nest API environment:

```text
DOCUMENT_UPLOADS_ENABLED=false
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<existing-project-ref>.supabase.co
SUPABASE_STORAGE_BUCKET=zat-private-documents
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase secret/service-role key>
```

The code intentionally does not enable uploads when these values are present. Change `DOCUMENT_UPLOADS_ENABLED` only after the checks and recovery drill below are approved and pass. No project, bucket, policy, key, or production setting was created or changed for this PR.

## Validation and access

- Maximum request file size is 8 MiB; Multer accepts one file. The API verifies PDF, JPEG, PNG, and WebP signatures, and strict UTF-8/plain-text content; the filename extension must match.
- Object keys are random and independent of the user filename. Original names are reduced to a safe display name. SVG, archives, office files, executable files, and unknown types are rejected.
- The service uses the private Storage object API with `apikey`/Bearer headers only from the Nest server. No signed URL or public URL is generated. Downloads are streamed through the existing authenticated API as attachments with `nosniff`.
- The current database schema already stores document metadata; no Prisma schema change or migration is included.

## Partial failures and deletion

- If object upload returns an error, the API attempts to delete that exact generated key because the remote outcome may be uncertain. If cleanup also fails, it logs the generated key (never file contents or credentials) and returns an explicit operator-attention error.
- If metadata insertion returns an error, the API checks for the generated key before compensating. If the row exists, it returns that confirmed record; if the check fails, it preserves the object and requests reconciliation rather than risking a metadata row that points to a deleted file. If the check confirms no row, it attempts object cleanup; a cleanup failure is explicitly reported.
- A process stop or ambiguous remote outcome can still leave an object without metadata. Reconcile bucket object keys against `StoredDocument.storageKey`; keep unknown objects quarantined for owner/retention review before any deletion.
- Authorized deletion removes the metadata row first, then removes the object through Storage. If object cleanup fails, the database no longer exposes it, the API returns an explicit error, and the generated key is logged for manual cleanup. The endpoint does not claim both operations succeeded.
- Deletion and an audit entry are committed together. The audit records object cleanup as pending; successful cleanup gets a separate completion event. A failure to record completion is reported explicitly while the pending event remains for reconciliation.
- There is no automatic expiration or deletion. No business/legal retention schedule is established in the repository. Deletion must be authorized, checked against the organization’s approved retention/legal-hold policy, and recorded operationally. Deletion is not reversible from the live bucket.

## Backup and recovery gate

Supabase database backups **do not include Storage object bytes**; they retain database metadata only. Before enabling uploads, provision and verify an independent, private, encrypted object backup outside this project’s bucket, with a manifest of object key, byte size, and SHA-256. Set and approve the backup retention period separately; do not assume database-backup retention covers documents.

Recovery drill required before activation:

1. Use only synthetic files in a non-production bucket and database.
2. Back up the synthetic object and manifest separately from PostgreSQL.
3. Restore PostgreSQL metadata to an isolated test database and retrieve the object copy into an isolated private bucket.
4. Verify object key, byte count, SHA-256, and an authorized application download; verify anonymous/direct public access is denied.
5. Exercise metadata-insert failure, failed compensating object delete, object-delete failure, and orphan reconciliation. Record the operator actions and evidence.

The unit tests cover local synthetic storage, fake Supabase HTTP operations, authorization/branch rejection, validation, metadata failure compensation, and cleanup failure reporting. They do **not** establish that a project/bucket exists or substitute for the full independent-backup restore drill. Uploads must stay disabled until that drill passes.

## Cost and project checks

The repository does not identify the Supabase project reference, plan, Storage usage, egress usage, bucket state, or billing owner. These must be checked in the existing project’s Dashboard before setup.

Supabase’s public pricing currently lists 1 GB Storage and 5 GB cached/uncached egress quotas on Free; Pro and Team list 100 GB Storage and 250 GB cached/uncached egress quotas. Published overages are $0.0213/GB-month for Storage, $0.09/GB uncached egress, and $0.03/GB cached egress. Actual charges depend on plan, organization-wide usage, and traffic; verify the current [pricing](https://supabase.com/pricing) and [usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) before enabling.
