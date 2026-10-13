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

## Self-hosted production

Use Node.js 22.13 or newer. The customer account database uses the built-in `node:sqlite` API; Node.js 24 LTS is recommended.

From the website repository, install and build with:

```
npm ci
npm run lint
npm run build
```

Set these server-side environment variables in the production process. Do not prefix them with `NEXT_PUBLIC_`; `.env.example` contains names and empty values only.

- `CRM_API_URL`
- `CRM_API_IDENTIFIER`
- `CRM_API_PASSWORD`
- `CUSTOMER_BOOKINGS_INTERNAL_TOKEN`
- `CUSTOMER_DATABASE_PATH`

For Hostinger, use the repository root as the app root and use `npm run build` and `npm start`. The build installs and compiles the NestJS backend before building Next.js. The root start command runs both from one process; API routes go to Nest, except website-owned `/api/account/*` and `/api/inquiries`, which continue to go to Next.js. The two explicitly supported `/v1/customer/*` routes also go to Nest.

Set `DATABASE_URL` to the Supabase PostgreSQL connection string and configure strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET` values in Hostinger's environment variables. Use `APP_URL=https://www.zayanahmedtravels.com` so the API accepts the live site's origin, and set `CRM_API_URL` to that same public origin for the website's server-to-server CRM calls. Set `CUSTOMER_BOOKINGS_INTERNAL_TOKEN` to the same value for the website and backend. The CRM credentials enable lead submission, and the internal token enables customer-booking retrieval. Set `CUSTOMER_DATABASE_PATH` to an absolute path on writable, persistent VPS storage. The app creates its parent directory, but the database file must survive application restarts and deployments. Back it up separately; it is the website's SQLite customer database, not the CRM database.

Start the production server with:

```
HOST=0.0.0.0 PORT=3000 npm start
```

The combined server binds to `0.0.0.0` and uses `PORT` for its listening port. Put a reverse proxy in front of the app and terminate HTTPS there. Use a process manager such as systemd or an equivalent supervisor to keep the Node.js process running and restart it after failures or reboots. Run `npm run db:migrate:deploy --prefix backend` after setting `DATABASE_URL` and before serving production traffic.