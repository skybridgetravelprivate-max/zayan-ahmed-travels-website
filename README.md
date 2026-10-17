# Zayan Ahmed Travels

Standalone website and CRM API for Zayan Ahmed Travels (Pvt.) Ltd.

Tagline: Your Journey, Our Responsibility

## Local development

Install website and backend dependencies with `npm ci` and `npm ci --prefix backend`.
Configure the approved development database privately in the ignored root
`.env.local`, then run `npm run dev`. It compiles and starts the API at
127.0.0.1:4000 and the website at http://localhost:3000.

See [LOCAL-DEVELOPMENT.md](./LOCAL-DEVELOPMENT.md) for configuration, tests and
local-only first-admin setup. Setup requires a private token and an empty staff
table; it cannot change an existing administrator or run in production. This
feature does not provide a staff dashboard. Use `npm run dev:website` only when
running the API separately with matching private configuration.

Useful checks: `npm run lint`, `npm test --prefix backend`,
`npm run test:dev-connected`, `npm run test:customer-auth`,
`npm run test:customer-bookings`, `npm run test:inquiries`, and `npm run build`.

## Production

Use Node.js 22.13 or newer. Website customers and sessions use PostgreSQL tables
separate from staff and CRM customers. Customer accounts no longer use SQLite.

Build with `npm run build`. Hostinger publishes the Next standalone artifact,
which is packaged with the combined website/API gateway. See
[HOSTINGER-RUNTIME.md](./HOSTINGER-RUNTIME.md) for the reviewed runtime behavior,
private settings, health checks and disabled document uploads.

See [CUSTOMER-ACCOUNT-MIGRATION.md](./CUSTOMER-ACCOUNT-MIGRATION.md) for the applied
migration, preserved legacy SQLite evidence and rollback limitations. Do not
reapply migrations, import rows, seed, reset, or restore automatically. Preserve
new PostgreSQL writes and original recovery copies. Private settings must never
be committed or exposed through `NEXT_PUBLIC_*`.

This local development change does not deploy, restart or configure Hostinger.
