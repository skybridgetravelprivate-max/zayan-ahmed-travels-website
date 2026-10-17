# Connected local website

Run `npm run dev` from the repository root. This builds and starts the Nest API on
127.0.0.1:4000 and the Next.js website at http://localhost:3000. Use `API_PORT` and
`PORT` to override these ports. Both servers bind only to loopback; ports must
be valid and different. The launcher sets local origins and development cookie
settings even when an environment file contains production URLs. Use an approved
development database: website requests can write to the configured database.

Keep `DATABASE_URL` and `DATABASE_SSL_CA` in the ignored root `.env.local` file.
`DATABASE_SSL_CA` contains the official Supabase PEM certificate, with line breaks
escaped as `\n`. Remote database certificate verification stays enabled.

The launcher supplies the local CRM origin and matching random server tokens for
the lifetime of the process when private development values are absent. No staff account,
seed script, or database reset is needed to receive website inquiries. Inquiries
are validated on both servers and saved with their sequence and audit entry in
one transaction. Existing staff-authenticated lead creation remains available.

Website customer accounts and sessions use dedicated tables in the PostgreSQL
database configured by `DATABASE_URL`; their identities remain separate from
staff accounts and CRM customers. Registration links the website customer to a
CRM customer through the protected server-to-server API. Booking queries use
the signed-in website customer's stored CRM identity. The launcher never runs
migrations, seeds, or imports. Check the approved database's migration status
and follow
[`CUSTOMER-ACCOUNT-MIGRATION.md`](./CUSTOMER-ACCOUNT-MIGRATION.md).

For a separate frontend process, use `npm run dev:website` and configure
`CRM_API_URL` and `CUSTOMER_BOOKINGS_INTERNAL_TOKEN` identically on both servers.
Production also requires those matching server settings and stable JWT secrets;
the development launcher's temporary secrets are not production configuration.

## First staff administrator on an empty development database

Set `FIRST_ADMIN_SETUP_TOKEN` privately in the ignored root `.env.local` to
32–512 random characters. Open http://localhost:3000/admin/setup and enter the
token and chosen staff credentials directly in the masked form. Existing staff
users disable setup; this flow cannot reset, replace, or add an administrator
when any staff account exists. The API accepts setup only with
`NODE_ENV=development`; the page returns 404 outside development.

The account, role and minimum permission records are created in one transaction
with a PostgreSQL advisory lock. Passwords use the existing hashing policy and
must fit bcrypt's 72-byte limit. On success the form verifies staff sign-in and a
protected API request, then remove only the setup token from the private local
environment and restart development. No staff dashboard is provided by this PR.

Validation: `npm run test:inquiries`, `npm run test:customer-bookings`,
`npm test --prefix backend`, `npm run lint`, and TypeScript checks in both projects.
Also run `npm run test:dev-connected`. Backend tests run with a minimal test
environment so private database and token values are not inherited. No hosting
configuration is changed by this local setup.
