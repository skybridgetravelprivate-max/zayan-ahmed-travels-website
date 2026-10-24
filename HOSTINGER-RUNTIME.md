# Combined Hostinger runtime

## Receipt write maintenance (prepared locally; not enabled in production)

Set `RECEIPT_WRITES_DISABLED=true` and restart the **candidate gateway** to return
503 with `private, no-store` and Retry-After for receipt mutations, including
explicit review. Receipt history, submission recovery and document GETs remain
available. Missing/empty/`false` leaves the normal mandatory-key/review contract
in force; any other nonempty value blocks writes. Existing browser retry keys
must be retained. This switch does not resolve uncertain payments.

Activation, restart and reopening production writes require separate release
authorization. Verify a 503 before rolling back. An older gateway does not
implement this switch: retain the tested gateway around the older application,
or first verify an independent external proxy write block that survives bundle
replacement. Do not roll back the gateway and assume this environment variable
still protects payments. Never restore a database snapshot as code rollback.

Hostinger's Next.js publisher starts `.next/standalone/server.js`. The build now
packages the compiled Nest API and its dependencies into that artifact and makes
the entry point run the existing combined gateway. Website account and inquiry
routes remain Next routes; CRM, health and staff routes run in Nest in the same
process and public port. No startup migration, import or seed is performed.

Configure private Hostinger variables before manually deploying the reviewed
commit: `DATABASE_URL`, `DATABASE_SSL_CA` (PEM or escaped newlines when needed),
distinct strong `JWT_SECRET` and `JWT_REFRESH_SECRET`, `COOKIE_SECURE=true`,
`APP_URL` with both approved HTTPS origins, `SITE_URL`, `CRM_API_URL` pointing to
the production site, and the same `CUSTOMER_BOOKINGS_INTERNAL_TOKEN` used by both
servers. Keep `START_MODE=all` and auto-deployment off. Credentials remain in the
server environment; the launcher no longer writes database credentials to disk.

Set `DOCUMENT_UPLOADS_ENABLED=false`. Production upload writes are disabled by
default unless explicitly enabled after persistent storage is verified. Existing
downloads are unchanged. This is an intentional temporary limitation, not proof
that old documents have been recovered or backed up.

After manual deployment, verify `/api/health` reports a healthy database, anonymous
staff endpoints deny access, first-admin setup remains unavailable, and customer
registration/login/bookings/logout and inquiry persistence work. Health returns
503 on database failure. Remote TLS always verifies the CA and hostname.

Preserve the old SQLite recovery copy and PostgreSQL backup. The accepted risk of
uncaptured SQLite writes does not turn the zero-row emergency copy into a final
snapshot. Do not delete or import it automatically. Rollback must preserve all new
PostgreSQL writes; do not return to SQLite-only customer storage or drop tables.
