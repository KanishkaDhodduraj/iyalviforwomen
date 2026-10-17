# Iyalvi

The customer storefront and the separate admin dashboard live in their own app folders:

- `customer/frontend/` is the React, TypeScript, and TanStack Start storefront.
- `customer/backend/` is the Express, TypeScript, and MongoDB API.
- `admin/frontend/` is the separate React + Vite administrator dashboard.
- `admin/backend/` is the separate Express + Mongoose administrator API.

## Setup and development

Install dependencies from the repository root:

```sh
npm run install:all
```

Run each app in a separate terminal from the repository root:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

The admin dashboard is available at `http://localhost:8090` when its API is running:

```sh
npm run dev:admin:backend
```

```sh
npm run dev:admin:frontend
```

The admin API listens on `http://localhost:5001`. Configure `admin/backend/.env` from
`admin/backend/.env.example` with the same `DATABASE_URL` used by the shop and a separate,
random `ADMIN_JWT_SECRET` of at least 32 characters. Set `ADMIN_CLIENT_URL` to
`http://localhost:8090` for local development. Bootstrap the first superadmin by supplying
`ADMIN_EMAIL` and `ADMIN_PASSWORD` in the admin backend environment and running
`npm --prefix admin/backend run create-admin`. There is no public admin registration.
In local development, the admin frontend automatically creates a session for the configured
superadmin account; this shortcut is available only on loopback and is disabled outside
development. Production continues to require the admin email and password.

The admin frontend has its own `admin/frontend/.env.example`. Credentials and sessions are
handled by the admin API using httpOnly cookies; no authentication tokens are stored in browser
storage.

Admin product images are processed locally and served from `/uploads/products/`. The shared
`uploads/` storage directory is ignored by Git except for its empty placeholders; generated
images and thumbnails are not committed.

Admin report exports are available at
`GET /api/reports/{sales|customers|payments|orders|inventory|discounts}?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|xlsx|pdf`
(format defaults to CSV).
Date ranges are required and limited to 366 days. Managers and superadmins can export every
report; support can export customers and orders with customer PII masked. PDF is available only
for sales, customers, and payments. Each export is rate-limited and written to the admin audit
log. Inventory exports select products updated during the requested period; stock and price
values represent the current product record because historical inventory snapshots are not stored.

The storefront is served at the URL printed by Vite (usually `http://localhost:5173`).
The backend listens on `http://localhost:5000`; the Vite dev server proxies `/api` requests
to it.

## Deploying to Vercel and Render

Deploy each frontend as its own Vercel project:

| Project | Root Directory | Build Command | Output |
| --- | --- | --- | --- |
| Customer storefront | `customer/frontend` | `npm run build` | Keep the Nitro/Vercel output setting at its default |
| Admin dashboard | `admin/frontend` | `npm run build` | `dist` |

Use Node.js 20 or later for both projects. Do not override the install command; Vercel can use
the `package-lock.json` in each project root. The admin dashboard's rewrite sends SPA routes to
`index.html`.

Both frontends leave `VITE_API_BASE_URL` empty by default, which routes API requests through
their same-origin `/api` Vercel rewrite. In each frontend's `vercel.json`, replace
`REPLACE-WITH-RENDER-URL` in both destinations with that frontend's matching Render service
hostname, for example `iyalvi-customer-api.onrender.com` or `iyalvi-admin-api.onrender.com`.
Keep `https://` and do not include a trailing slash or `/api`. The Vercel configuration files
are strict JSON and cannot contain comments; this paragraph documents the placeholder replacement.
If setting `VITE_API_BASE_URL` to a backend URL instead, use the backend origin without `/api`
and set that backend's `COOKIE_SAME_SITE=none` so secure cookies can be sent cross-site.

The root `render.yaml` defines both backend services. Deploy it as a Render Blueprint; each
service uses `npm install && npm run build`, `npm start`, and `/api/health` for health checks.
Set these service environment variables in Render:

| Service | Required variables |
| --- | --- |
| Customer API | `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), `CLIENT_URL` (the exact customer Vercel origin) |
| Admin API | `DATABASE_URL`, `ADMIN_JWT_SECRET` (at least 32 characters), `ADMIN_CLIENT_URL` (the exact admin Vercel origin) |

The Blueprint sets `NODE_ENV=production` and `TRUST_PROXY=1`. Cookie SameSite defaults to
`lax` for same-origin Vercel proxy rewrites; set `COOKIE_SAME_SITE=none` only when calling a
backend cross-site directly from a frontend, and keep production HTTPS enabled.

## Backend setup

Create `customer/backend/.env` locally (it is ignored by Git) with a MongoDB connection URI,
a random `JWT_SECRET` of at least 32 characters, and `CLIENT_URL`. The server accepts either
`DATABASE_URL` or the Atlas-style `MONGODB_URI` variable. Google sign-in and online payments
are disabled; no Google or payment secrets are required. Never put credentials in frontend
environment variables or commit them.

```sh
npm --prefix customer/backend run db:indexes
npm --prefix customer/backend run seed
```

Create indexes before seeding; production disables automatic index creation, so run the
index command during database setup and after model index changes. The seed command upserts the
existing frontend catalog without resetting stock on later runs. Browser clients must first fetch
`GET /api/auth/csrf` with credentials enabled, then send the returned `x-csrf-token` header and
cookies with state-changing requests. Sessions use httpOnly cookies; the API does not return
access or refresh tokens in JSON.
