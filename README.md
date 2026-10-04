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

The CRM credentials enable lead submission, and the internal token enables customer-booking retrieval. Set `CUSTOMER_DATABASE_PATH` to an absolute path on writable, persistent VPS storage. The app creates its parent directory, but the database file must survive application restarts and deployments. Back it up separately; it is the website's SQLite customer database, not the CRM database.

Start the production server with:

```
HOST=0.0.0.0 PORT=3000 npm start -- --hostname 0.0.0.0
```

Next.js `next start` defaults to `0.0.0.0`; `PORT` selects the listening port, while the explicit `--hostname` option sets the bind address. Put a reverse proxy in front of the app and terminate HTTPS there. Use a process manager such as systemd or an equivalent supervisor to keep the Node.js process running and restart it after failures or reboots.