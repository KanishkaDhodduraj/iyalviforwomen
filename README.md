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
`npm --prefix admin/backend run create-admin`. There is no public admin registration. Sign in
from the admin login page using a provisioned administrator account.
For a non-production environment, run `npm --prefix admin/backend run reset-admin` with
`ADMIN_EMAIL` and `ADMIN_PASSWORD` set in the process environment to create or reset that
superadmin; passwords must be at least 8 characters. This command refuses to run when
`NODE_ENV=production`.
Administrator cookies are browser-session cookies. The server maintains an eight-hour rolling
refresh-token inactivity window. Review customer contact messages in the admin workspace.

The admin frontend has its own `admin/frontend/.env.example`. Credentials and sessions are
handled by the admin API using httpOnly cookies; no authentication tokens are stored in browser
storage.

In production, admin product uploads require a cloud-backed `ImageStorage` implementation.
Until one is configured, upload requests return HTTP 503; creating and editing products without
images continues to work. Local development stores processed image files under `/uploads/products/`.

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

## Deploying to Vercel

Deploy four separate Vercel projects from this repository. Use these project root directories
and build settings:

| Project | Root Directory | Build Command | Output Directory |
| --- | --- | --- | --- |
| Customer storefront | `customer/frontend` | `npm run build` | Nitro/Vercel default |
| Customer API | `customer/backend` | `npm run build` | Leave unset; deploy the `api/index.ts` function |
| Admin dashboard | `admin/frontend` | `npm run build` | `dist` |
| Admin API | `admin/backend` | `npm run build` | Leave unset; deploy the `api/index.ts` function |

Use Node.js 20 or later and the package manager's default install command in each project.
Both API projects route requests to their serverless Express handler, set a 30-second function
duration, and connect to MongoDB on the first request. Configure the MongoDB network access
rules to allow Vercel's deployments.

For both frontend projects, leave `VITE_API_BASE_URL` empty to use same-origin `/api` calls.
In `customer/frontend/vercel.json`, replace `REPLACE-WITH-CUSTOMER-API-VERCEL-DOMAIN` with
the customer API project's Vercel hostname and `REPLACE-WITH-ADMIN-API-VERCEL-DOMAIN` with
the admin API project's hostname. In `admin/frontend/vercel.json`, replace
`REPLACE-WITH-ADMIN-API-VERCEL-DOMAIN` with the admin API hostname. Keep the `https://`
scheme and omit a trailing slash. The SPA rewrite for the admin frontend stays after its API
rewrites.

Configure backend environment variables in each API project's Vercel Project Settings:

| Project | Environment variable names |
| --- | --- |
| Customer API | `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV`, `TRUST_PROXY`, `COOKIE_SAME_SITE`, optional `DEMO_PAYMENTS` |
| Admin API | `DATABASE_URL`, `ADMIN_JWT_SECRET`, `ADMIN_CLIENT_URL`, `NODE_ENV`, `TRUST_PROXY`, `COOKIE_SAME_SITE`, `CRON_SECRET` |

Set `NODE_ENV=production`, `TRUST_PROXY=1`, and `COOKIE_SAME_SITE=lax` for same-origin
frontend proxy rewrites. Set `CLIENT_URL` and `ADMIN_CLIENT_URL` to the exact deployed
customer and admin frontend origins respectively. Set `DEMO_PAYMENTS=true` only when demo
payment orders are desired. Set a high-entropy `CRON_SECRET`; Vercel calls the admin API's
promotion-expiry endpoint daily at 02:00 UTC and supplies the bearer secret.

Admin product image uploads return HTTP 503 with `Image storage not configured` in production
until a cloud-backed `ImageStorage` implementation is configured. Creating and editing
products without uploading images remains available. Local disk uploads are for development
only.

## Backend setup

The customer backend needs `DATABASE_URL` (or `MONGODB_URI`), `JWT_SECRET` (at least 32
characters), and `CLIENT_URL`. `DEMO_PAYMENTS` is optional and defaults to disabled. When
enabled, checkout records a demo order without contacting a payment gateway or collecting
card numbers. Never put credentials in frontend environment variables or commit them.

```sh
npm --prefix customer/backend run db:indexes
npm --prefix customer/backend run seed
```

Create indexes before seeding; production disables automatic index creation, so run the
index command during database setup and after model index changes. The seed command creates
only the default store settings document; products and media are managed from the admin app.
Browser clients must first fetch
`GET /api/auth/csrf` with credentials enabled, then send the returned `x-csrf-token` header and
cookies with state-changing requests. Sessions use httpOnly cookies; the API does not return
access or refresh tokens in JSON.
