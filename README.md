# Iyalvi

The customer-facing applications live under `customer/`, leaving the repository root ready
for a future admin application:

- `customer/frontend/` is the React, TypeScript, and TanStack Start storefront.
- `customer/backend/` is the Express, TypeScript, and MongoDB API.
- `admin/` can be added alongside `customer/` when the admin application is ready.

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
