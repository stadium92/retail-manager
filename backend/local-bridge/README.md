# LocalBridge Service

Embedded offline backend that powers Retail Manager when Supabase is unavailable.

## Commands

```bash
npm install          # install deps
npm run dev          # start Fastify server with tsx (default port 8787)
```

Or from the frontend workspace:

```bash
cd Pro/retail-manager/frontend
npm run backend:dev
```

## Environment Variables

See `.env.example` for defaults:

- `PORT` – HTTP port (default `8787`).
- `DATA_DIR` – directory for the SQLite database (default `./data`).
- `JWT_SECRET` – secret used for signing offline access tokens.

Copy `.env.example` to `.env` to override values locally.

## Routes (initial scaffolding)
- `GET /health` – returns service status and DB file path.
- `POST /auth/bootstrap` – one-time endpoint to create the first master user on a device. Returns 409 if a master already exists.
- `POST /auth/login` – validates email/password against the local SQLite store and returns JWT/refresh tokens plus role metadata.
- `POST /auth/refresh` – accepts a refresh token and returns a rotated token pair (access + refresh) if the session is still valid.
- `POST /auth/logout` – invalidates the provided refresh token/session.
- `POST /auth/workers` – master-only endpoint to provision offline worker/deliverer accounts (creates user + role rows).
- `GET /rest/v1/products` – returns products for the authenticated store (or explicit `store_id`).
- `GET /rest/v1/product_families` – lists product families for the given store.
- `POST /rpc/worker_create_product` – worker/master endpoint that mirrors the Supabase RPC to create products locally.
- `PATCH /rest/v1/products/:id` – update an existing product (master or same-store worker).
- `DELETE /rest/v1/products/:id` – remove a product (master only).
