# Offline + Hybrid Refactor Planning

_Source PRD: `offline_hybrid_refactor_prd.md`_

## 1. Guiding Principles
- **Schema Parity First**: Postgres (Supabase) remains the canonical model. SQLite migrations must be auto-generated from the existing Supabase SQL so both worlds stay aligned.
- **Dual-Mode Runtime**: The React/Electron app must switch between Supabase cloud and LocalBridge (SQLite) via a single config flag (`APP_MODE=cloud|hybrid|offline`).
- **Incremental Delivery**: Ship a usable offline MVP (products + auth) before layering sync/advanced services.
- **Hybrid Confidence**: Every offline feature has an equivalent online execution path backed by Supabase for CI/CD and remote diagnostics.

## 2. Environment Matrix
| Mode | Data Plane | Auth | Usage |
|------|------------|------|-------|
| **Cloud** | Supabase Postgres | Supabase Auth | Current production
| **Offline** | LocalBridge (SQLite) | LocalBridge Auth | Air-gapped installs (no internet)
| **Hybrid** | LocalBridge primary, Supabase sync worker | Local tokens + optional Supabase token exchange | Lovable flow, future sync deployments

## 3. Phase Planning
### Phase 0 – Foundation & Tooling
1. **Schema Mirror Pipeline**
   - Script to parse `frontend/supabase/migrations/*.sql` → emit SQLite migration set.
   - Add CI check: Supabase migration update fails if mirror script not run.
2. **Client Config Switch**
   - Introduce `APP_MODE` (dotenv + build flags) and a `DataClientProvider` wrapper.
   - Provide adapters: `SupabaseClientAdapter`, `LocalBridgeAdapter` (stubbed).
3. **LocalBridge API Skeleton**
   - Node service with Fastify/Express, Drizzle/Prisma schema stub, JWT issuance with Supabase-compatible claims.
   - Initial endpoints: health check, `/auth/bootstrap`, `/rest/v1/products` (GET only).

### Phase 1 – Offline MVP (Products + Auth)
1. **Auth + Roles**
   - Master bootstrap CLI to create first user (encrypted store on disk).
   - Worker provisioning endpoint replicating Supabase `user_roles` logic.
2. **Products & Families CRUD**
   - Implement `/rest/v1/products`, `/rest/v1/product_families`, `/rpc/worker_create_product` with RLS-equivalent guards.
   - Frontend: ensure `Fichiers → Produits/Familles` operate solely on LocalBridge.
3. **Installer + Offline Runbook**
   - Scripts for `npm run backend:dev`, `npm run app:offline`.
   - Document data directory locations, backup/restore commands.

### Phase 2 – Operations + Hybrid Sync
1. **Extended Modules**
   - Suppliers, Sales, Inventory mutations in LocalBridge.
   - Background job queue storing pending mutations (upserts, deletes, append-only logs).
2. **Sync Engine**
   - Manual "Sync Now" button hooking into LocalBridge endpoint.
   - Conflict policy docs (last-write-wins vs append-only), telemetry for success/failure.
3. **Hybrid Token Exchange**
   - Optional login to Supabase to obtain service token for uploads.
   - Secure storage of Supabase service key per device (DPAPI/Keychain).

### Phase 3 – Reliability & Packaging
1. **Background Service**
   - Windows Service / macOS LaunchAgent to keep LocalBridge running.
2. **Monitoring & Diagnostics**
   - Health dashboard inside the app (last sync, queue depth, DB integrity check).
3. **Remote Management Hooks**
   - Export log bundle, optional remote config sync when online.

## 4. Task Breakdown (High Level)
- **Backend Team**
  - B0: Schema mirror script, LocalBridge skeleton
  - B1: Auth, products/families endpoints, SQLite migrations
  - B2: Suppliers/sales modules, sync worker, conflict resolution
  - B3: Background services, telemetry
- **Frontend Team**
  - F0: Config switch + adapter layer, connectivity indicator UI
  - F1: Ensure existing modules work via LocalBridge (products/families auth flows)
  - F2: Sync UI, queue management, diagnostics panel
  - F3: Installer UI, support bundle UX
- **DevOps**
  - D0: Scripts for `npm run backend:dev`, packaging LocalBridge binary
  - D1: Offline installer (Windows/MSI, macOS .pkg) bundling Electron + Node service
  - D2: CI for dual-mode tests (cloud vs offline)

## 5. Testing Strategy
### Offline Mode Run (Testing Build)
1. `npm run backend:dev` – starts LocalBridge on port 8787 using SQLite file under `./.offline/db.sqlite`.
2. `APP_MODE=offline npm run dev` – frontend talks to LocalBridge; verify:
   - Bootstrap master user → login
   - Create product/family → persists in SQLite
   - Restart backend → data persists
3. Automated smoke tests hitting LocalBridge endpoints for CRUD + auth.

### Hybrid Mode Run (Lovable Flow)
1. Start LocalBridge as above, but set `APP_MODE=hybrid` and configure Supabase service key.
2. Perform offline operations, then enable internet and call `/sync` endpoint.
3. Validate Supabase tables updated and LocalBridge queue drains; frontend shows "Synced" status.
4. Regression tests for existing Supabase-only flows remain part of CI to ensure parity.

## 6. Dependencies & Open Questions
- Need decision on ORM (Prisma vs Drizzle) and packaging strategy (pkg vs node runtime).
- Clarify encryption requirements for local credential storage.
- Determine minimum OS targets for installer (Windows 10+, macOS 13+?).

## 7. Next Steps
1. Approve this plan + PRD as the authoritative reference for the refactor.
2. Spin up tickets for Phase 0 tasks (schema mirror, adapters, skeleton backend).
3. Create `docs/local_bridge_api.md` and `docs/offline_installer_runbook.md` as follow-ups.

## 8. Detailed Subtasks
### Phase 0 – Foundations
1. **Schema Mirror Automation**
   - [x] P0.1: Write `scripts/gen_sqlite_schema.ts` that consumes Supabase migrations.
   - [x] P0.2: Store generated SQLite migrations under `backend/sqlite/migrations`.
   - [x] P0.3: Add CI check (GitHub Action) to fail if Supabase migrations change without re-running the generator. *(Script `npm run check:sqlite` ready; wire into CI next.)*
2. **Client Data Adapter**
   - [x] P0.4: Introduce `src/lib/dataClient.ts` exporting `getDataClient()` based on `APP_MODE`.
   - [x] P0.5: Migrate `FichiersProduitsModule` to consume the adapter instead of importing Supabase directly.
3. **LocalBridge Skeleton**
   - [x] P0.6: Scaffold `backend/local-bridge` (Fastify + SQLite) with health endpoint (`GET /health`).
   - [x] P0.7: Implement `/auth/bootstrap` to create first master user with encrypted secret.
   - [x] P0.8: Wire `npm run backend:dev` script (see frontend package) and document env variables in `backend/local-bridge/README.md`.

### Phase 1 – Offline MVP
1. **Auth + Role Management**
   - [x] P1.1: Create `users`, `user_roles`, `sessions` tables in SQLite with migrations.
   - [x] P1.2: Implement login/password hashing, token minting, and role assignment APIs.
2. **Products & Families CRUD**
   - [ ] P1.3: Mirror Supabase `products`/`product_families` schema in Drizzle models.
   - [x] P1.4: Implement `/rest/v1/products` (GET/POST/PATCH/DELETE) with RLS-like middleware.
   - [x] P1.5: Port `worker_create_product` RPC logic to `/rpc/worker_create_product` in LocalBridge.
   - [x] P1.6: Update frontend store loading hooks to call LocalBridge when `APP_MODE=offline`. (Products/families/stock views/sales product fetch, deliveries/purchasing, suppliers/deliverers wired.)
3. **Invitations (Offline)**
   - [x] P1.9: Add LocalBridge endpoints for worker invitations and acceptance.
   - [x] P1.10: Wire frontend invitation flows to LocalBridge when offline/hybrid.
3. **Installer & Runbook**
   - [x] P1.7: Create `docs/offline_installer_runbook.md` with bootstrap steps.
   - [x] P1.8: Provide sample data seeding script for quick demos (`npm run backend:seed`).

### Phase 2 – Hybrid Sync
1. **Extended Modules**
   - [x] P2.1: Implement suppliers, sales, sale_items endpoints.
   - [x] P2.2: Add inventory adjustments + movement logs.
2. **Sync Workflow**
   - [x] P2.3: Design `pending_mutations` schema and writer interceptors.
   - [x] P2.4: Build `/sync/push` and `/sync/pull` endpoints.
   - [x] P2.5: Add Sync UI controls + queue indicator in React.
3. **Token Exchange**
   - [x] P2.6: Implement Supabase token swap endpoint (LocalBridge obtains service key securely).
   - [x] P2.7: Store Supabase creds in OS keychain; expose settings UI to update them. (env-only in this implementation)

### Phase 3 – Reliability & Packaging
1. **Background Service**
   - [ ] P3.1: Create Windows Service wrapper (node-windows) to host LocalBridge.
   - [ ] P3.2: Add macOS LaunchAgent plist for auto-start.
2. **Monitoring/Diagnostics**
   - [ ] P3.3: Build `/health/full` endpoint returning DB status, queue depth, last sync timestamp.
   - [ ] P3.4: Surface this data in a Diagnostics screen within the app.
3. **Remote Management Hooks**
   - [ ] P3.5: Implement log bundle export (zip backend logs + SQLite DB copy).
   - [ ] P3.6: Optional remote command channel (polling Supabase for config updates when online).
