# Isolated public-schema recovery

Latest follow-up: the [operational backup plan](operational-backup-plan.md) records a fresh 22 November encrypted populated financial/object drill with all 18 current migrations: 104 matched tables, 178 validated foreign keys, 18 journals/six receipts with exact balanced 1040.00 totals, and paired document restoration. That new archive remains local and synthetic. It does not change the scope of the older production archive below or the independently retrieved pre-PR44 snapshot.

This procedure was exercised on PostgreSQL 17.12 on 19 November 2026 against the encrypted pre-release archive. Keep the decrypted archive, extracted SQL, database files, passwords, and recovery identity in an owner-restricted directory outside the repository.

## Verified archive

Encrypted file name: zat-public-pre-release-20261119.dump.age

Encrypted SHA-256: 7202AB5B0491D1BFB2FABEAFB7EBA89C068C64A1A37748A6A0C26B4428D3F71D

Decrypted SHA-256: 660C76084CA4ADA8B8DCDE5627956F9E8B7188B57CBED6452FF7454EB544BB6A

The restore matched 101 tables and 519 rows against the archive's COPY records. All 177 foreign keys were validated with zero orphan rows. Fifteen migrations were completed. Prisma successfully read users, customers, Umrah bookings, stored documents, journals, website customers, and CMS pages using the application's generated client.

This snapshot contains one staff account, one customer, one website customer, zero stored-document records, and zero journals. Applying the current additive customer-recovery migration to this restored snapshot also succeeded. The separate synthetic financial/object drill below covers records absent from this production snapshot.

## Prepare the destination

Install PostgreSQL 17 client/server tools, age, and the repository dependencies. Use a fresh local cluster bound to 127.0.0.1 with password authentication and database timezone UTC. The exercised port was 55463. When starting it with pg_ctl, use options `-p 55463 -h 127.0.0.1 -c timezone=UTC`. Confirm `SHOW timezone` returns UTC before application acceptance tests: the Windows initdb default can inherit Asia/Karachi, and this exercise reproduced a five-hour timestamp shift through the Prisma timestamp path with that default. Store data and logs in the restricted directory. Use a fresh database name beginning zat_restore_ for each exercise.

Set these variables in the private operator session. ZAT_PRIVATE_RESTORE_DIR and ZAT_RECOVERY_IDENTITY are local paths. PGPASSWORD is the disposable cluster password. ZAT_RESTORE_DATABASE_URL must refer to the same loopback database.

~~~powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55463'
$env:PGUSER = 'zat_restore'
$env:PGDATABASE = 'zat_restore_20261119'
if ($env:PGDATABASE -notmatch '^zat_restore_[a-z0-9_]+$') { throw 'Unexpected restore target' }
if ($env:PGHOST -ne '127.0.0.1') { throw 'Expected loopback target' }
~~~

## Verify, decrypt, and restore

Start from a new empty database. An earlier exercise that has received newer migrations should be retained or explicitly removed as disposable, then replaced with a new empty destination before replaying this snapshot.

~~~powershell
$archive = Join-Path $env:ZAT_PRIVATE_RESTORE_DIR 'zat-public-pre-release-20261119.dump.age'
$dump = Join-Path $env:ZAT_PRIVATE_RESTORE_DIR 'source.dump'
$sourceSql = Join-Path $env:ZAT_PRIVATE_RESTORE_DIR 'source-data.sql'
$expected = '7202AB5B0491D1BFB2FABEAFB7EBA89C068C64A1A37748A6A0C26B4428D3F71D'
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Encrypted checksum mismatch' }
age --decrypt --identity $env:ZAT_RECOVERY_IDENTITY --output $dump $archive
if ($LASTEXITCODE -ne 0) { throw 'Decryption failed' }
if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash -ne '660C76084CA4ADA8B8DCDE5627956F9E8B7188B57CBED6452FF7454EB544BB6A') { throw 'Decrypted checksum mismatch' }
createdb $env:PGDATABASE
if ($LASTEXITCODE -ne 0) { throw 'Fresh database creation failed' }
pg_restore --dbname $env:PGDATABASE --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction $dump
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
pg_restore --data-only --no-owner --no-acl --file $sourceSql $dump
if ($LASTEXITCODE -ne 0) { throw 'Archive data extraction failed' }
$env:ZAT_RESTORE_SOURCE_SQL = $sourceSql
node backend/scripts/verify-restored-public.cjs
if ($LASTEXITCODE -ne 0) { throw 'Restore validation failed' }
~~~

The validator permits loopback targets with the zat_restore_ prefix. It compares every archived table count, validates foreign keys and orphan counts, checks migration completion, and exercises application ORM reads. Its output contains counts and schema information. Set ZAT_RESTORE_EVIDENCE_PATH to retain the aggregate JSON result in an approved local location.

The verification transaction is read-only. Apply repository migrations only after baseline verification, using DATABASE_URL for this same isolated database and npm run db:migrate:deploy --prefix backend. Verify migration status afterward.

## Scope and recovery limits

The archive covers public application tables, data, indexes, constraints, enums, and migration history as of the snapshot. It predates migration 20261115100000_website_customer_password_recovery and subsequent production writes. A new snapshot is required to recover those writes.

The exercise used --no-owner and --no-acl so Supabase roles and grants are not recreated on the local cluster. RLS policy and runtime-role acceptance on a replacement hosted project requires a separate review. The archive excludes Supabase storage object bytes, other schemas, project settings, mailbox credentials, application secrets, DNS, hosting deployment artifacts, and external supplier state.

Document byte recovery was separately exercised with synthetic data in persistence.pg17.spec.ts and document-backup.spec.mjs. Production document activation, independent offsite retrieval, and independent recovery-key custody remain separate acceptance tasks.

Stop the local cluster after verification. Keep restored records private and remove disposable plaintext artifacts through the approved local data-retention process. Use the retained application revision for code rollback. A database restore replaces data and requires its own recovery decision.

## Encrypted synthetic financial and object drill

`backend/scripts/financial-restore-journey.cjs` was exercised against the existing disposable payment-integration fixtures on PostgreSQL 17.12/UTC. It packages a public-schema dump with a paired synthetic document export, encrypts the package with age, decrypts using the existing local recovery identity, and restores into a fresh database. It does not accept remote database URLs, arbitrary source databases, existing output directories or an existing destination database.

Prerequisites: built backend, PostgreSQL 17 tools, age, tar, and a seeded `zat_synthetic_payment_integration` database. Seed using `backend/apps/api/src/finance/payment-integration.pg17.spec.ts` against that disposable database; never copy production records into it. No concurrent writer should use the fixtures during the snapshot/fingerprint comparison.

Set the following in a private operator session, then run `node backend/scripts/financial-restore-journey.cjs` from the repository root:

* `ZAT_SYNTHETIC_DATABASE_URL`: PostgreSQL URL for `127.0.0.1:55463/zat_synthetic_payment_integration`.
* `ZAT_RESTORE_DATABASE_URL`: same loopback server/credentials, fresh database named `zat_restore_financial_` plus a lowercase alphanumeric/underscore suffix.
* `ZAT_PG_BIN`: PostgreSQL 17 binaries directory.
* `ZAT_AGE_BIN`: age executable path.
* `ZAT_RECOVERY_IDENTITY`: local age identity path; keep its contents private.
* `ZAT_RECOVERY_RECIPIENT`: corresponding public age recipient.
* `ZAT_FINANCIAL_RESTORE_OUTPUT`: fresh, nonexisting output directory whose parent exists.

The tested drill matched 102 tables / 167 rows, 178 validated foreign keys / zero orphans, and 16 complete migrations. Eighteen journals and six receipts retained their exact financial fingerprint, with debit and credit totals each `1040.00`. Application reads succeeded. One paired document had no missing/orphan objects, retained metadata, downloaded with private headers, denied a foreign branch, and matched its hash in a fresh Node process.

The output contains `financial-recovery.tar.age` and aggregate `result.json`. Keep the checksum from that run with its artifact; encryption produces a different ciphertext hash each run. Plaintext source/extracted packages contain synthetic fixtures only. The restored database contains those same fixtures and is separate from the source. Stop the disposable cluster when finished. This drill does not establish an offsite copy, independent key custody, hosted storage durability, or hosted roles/RLS correctness.
