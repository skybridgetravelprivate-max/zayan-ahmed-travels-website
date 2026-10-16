# Website customer account database migration

Website customer identities and sessions use dedicated `website_customers` and
`website_customer_sessions` PostgreSQL tables. They are separate from staff
`User`/`Session` records and CRM `Customer` records. `crm_customer_id` remains a
soft link to the CRM customer identifier; it is not a foreign key or an identity
merge. PostgreSQL access is server-only and uses the shared verified-TLS
configuration.

## Current preparation state

- The new Prisma migration is
  `backend/packages/database/prisma/migrations/20261016090000_website_customer_accounts/migration.sql`.
- It was applied to the approved Supabase project on 2026-10-16. Verification
  confirmed 12 successful migrations, the expected tables and indexes, and a
  matching migration checksum. Do not edit or reapply this migration.
- No SQLite data has been imported.
- The final production SQLite source has not been captured or inventoried.
  The available recovery copy had zero customers and sessions at
  `2026-10-16T15:57:17Z`; it is not a final consistent snapshot and does not
  prove that later writes or other production databases are absent.
- Preserve the SQLite recovery copy and any remaining original database
  evidence unchanged. Do not infer that production data is absent from the
  earlier copy or local searches.

## Applied migration checksum and line endings

The migration was applied from a Windows checkout with CRLF line endings. Its
recorded Prisma checksum is
`b0d0e92ad9883b7abbfdf7e9d7b3c686142838267d757e6e0b6b617f47d33626`.
The reviewed GitHub migration content uses LF and hashes to
`5db0896e5e6653ba9c4f2378bb25b54b90e692db6e4b1d5582825328266f2771`.
The SQL content is identical after line-ending normalization. A read-only
Prisma status check using LF-normalized migration files reported the schema
up to date with no checksum warning. Do not alter the applied migration or
the `_prisma_migrations` ledger to reconcile these byte-level hashes.

## Private configuration

Set `DATABASE_URL` in the server environment to the existing approved
PostgreSQL connection. Keep its current password. Use `DATABASE_SSL_CA` only
when the provider requires its private CA; certificate and hostname
verification remain enabled. Do not expose these variables to browser code or
prefix them with `NEXT_PUBLIC_`. The runtime also accepts `POSTGRES_PRISMA_URL`
or `POSTGRES_URL` as server-side fallbacks.

The importer reads the root `.env.local` through Next's environment loader for
local use, or the process environment on the host. It prints counts and
conflict categories only, never row values, emails, hashes, URLs, or secrets.

## Review, migration, and import order

1. Capture a consistent final SQLite snapshot after a verified account-write
   pause and request drain. A raw copy of a live database file and an
   `integrity_check` result alone do not prove that committed transactions and
   sidecars were included.
2. Confirm that exactly the expected migration history is present using
   Prisma migration status. The website customer account migration has
   already been applied; do not run `db push`, reset, seed, or reapply it.
3. Run the importer in dry-run mode first, against the preserved final
   snapshot:

   ```powershell
   node scripts/import-website-customers.cjs --source "C:\absolute\path\customers.sqlite"
   ```

   It reads SQLite read-only and checks integrity, normalized-email
   collisions, missing customer references, and target ID/email/token
   conflicts. Exact rows already imported are reported as already present.
   Any non-identical conflict blocks the entire import.
4. If the verified source has no customer or session rows, skip the import.
   Otherwise, review the dry-run counts and conflicts and obtain explicit
   approval for the exact non-empty import before running the same command
   with `--apply`. The importer uses a serializable PostgreSQL transaction,
   parameterized inserts, and post-insert source-ID count checks. Any error or
   count mismatch rolls back that transaction. The SQLite original is never
   modified or removed.
5. Verify source and PostgreSQL customer/session counts, password-hash login,
   existing session behavior, CRM links, and that authenticated booking
   requests still resolve only through the signed-in website customer. Do not
   print personal data or credentials in verification logs.
6. Only after these checks, explicitly approve the production application
   cutover to the PostgreSQL-backed website code. Do not deploy as part of
   migration preparation.

The importer can be rerun: exact identical rows are treated as already
present, while divergent records and identifier collisions stop the complete
transaction. Expired sessions retain their original expiration and are cleaned
up by the application after cutover.

## Verification and rollback

Before switching traffic, compare total source customers/sessions with the
importer verification counts and retain the original SQLite file and a
consistent PostgreSQL backup. Verify registration/login/logout, expired and
revoked session rejection, CRM identity linking, and cross-customer booking
isolation. Confirm secure, HTTP-only, same-site customer cookies over HTTPS.

Before any PostgreSQL account writes occur, rollback is a code/configuration
rollback; keep the SQLite source untouched. Once writes have started in
PostgreSQL, switching the application back to SQLite alone loses those new
account/session changes. Stop and obtain approval for a reconciliation plan
before any reverse import or restore. Never reset or overwrite the shared CRM
database as part of application rollback.
