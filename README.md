# Zayan Ahmed Travels

Standalone website foundation for Zayan Ahmed Travels (Pvt.) Ltd.

Tagline: Your Journey, Our Responsibility

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

Open [http://localhost:3000](http://localhost:3000) after starting the development server.

## Production deployment

The website's customer accounts and sessions use dedicated PostgreSQL tables; they do not use SQLite. The NestJS API is compiled before the Next.js standalone build and started by Next.js instrumentation on a private, per-process loopback port. Same-origin `/api/*` requests are proxied to that instance, so Hostinger can use its generated standalone `server.js` without a second public service or an `example.invalid` rewrite. The standalone bundle includes only production backend dependencies.

Hostinger's build command is `build` (`npm run build` at the repository root). It compiles the API and builds the website. Hostinger must launch the generated standalone `server.js`; `npm start` uses the same artifact for local production checks. Do not start the legacy backend gateway for the website. Build and startup do not migrate, import, seed, reset, or push database schema.

Configure these server-only variables privately in Hostinger:

- `DATABASE_URL` and `DATABASE_SSL_CA` for the existing Supabase PostgreSQL project. Remote PostgreSQL connections use certificate and hostname verification.
- Stable, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` values for staff sessions.
- `APP_URL` with every served public site origin, comma-separated and including `https://` (both apex and `www` are currently served).
- The existing `CUSTOMER_BOOKINGS_INTERNAL_TOKEN`, unchanged and shared by website and backend code.
- `CRM_API_IDENTIFIER` and `CRM_API_PASSWORD` for website inquiry-to-CRM authentication.
- `CUSTOMER_WRITES_ENABLED=false` during initial deployment; enable only after database health and account smoke tests pass.
- `UPLOAD_WRITES_ENABLED=false`; production uploads remain unavailable because the current local driver is not a verified durable private provider.

Do not add these values to `NEXT_PUBLIC_*`, source control, build artifacts, or support messages. Keep cookie settings secure in production. Do not add seed-admin settings or run seeds. The reviewed customer-account migration is already applied; subsequent deployments must not run migrations automatically.

The local filesystem storage driver can serve existing files only when they are present at the configured private path. Production upload writes always return HTTP 503; setting `UPLOAD_WRITES_ENABLED=true` cannot override the production safeguard. Do not enable upload writes or change storage configuration until a durable private provider and existing document references are verified.