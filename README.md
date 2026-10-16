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
