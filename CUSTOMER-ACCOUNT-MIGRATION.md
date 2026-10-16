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
- It has **not** been applied to Supabase.
- No SQLite data has been imported.
- The only accessible SQLite file found locally was `data/customers.sqlite`; a
  read-only inventory found 0 customer rows and 0 session rows. Production data
  was not inspected and must not be inferred absent.
- The SQLite source must remain unchanged and retained through the migration
  and the agreed rollback window.

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

1. Inventory the actual SQLite source on the host using a read-only procedure.
   Confirm it is the correct customer database and preserve a verified copy.
   Do not infer that customer data is absent from a partial listing or local
   search.
2. Review the Prisma schema and SQL migration. Apply this migration only after
   explicit approval, using the database workspace's migration deploy command
   (not `db push`):

   ```powershell
   npm run db:migrate:deploy --prefix backend
   ```

3. Run the importer in dry-run mode first, against the preserved source file:

   ```powershell
   node scripts/import-website-customers.cjs --source "C:\absolute\path\customers.sqlite"
   ```

   It reads SQLite read-only and checks integrity, normalized-email
   collisions, missing customer references, and target ID/email/token
   conflicts. Exact rows already imported are reported as already present.
   Any non-identical conflict blocks the entire import.
4. Review the count/conflict output. If approved, run the same command with
   `--apply`. The importer uses a serializable PostgreSQL transaction,
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
