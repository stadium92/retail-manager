<context>
# Overview
Retail Manager needs to operate reliably without internet connectivity while retaining cloud sync benefits when a network is present. Today the app depends entirely on Supabase (hosted Postgres + Auth + Edge Functions) for data mutation and role enforcement, which blocks deployments in offline stores and causes field teams to spend hours debugging connectivity. This refactor introduces an embedded "mini-backend" that runs locally (SQLite + lightweight API/auth service) yet fully mirrors the Supabase schema so data can sync when online. The target audience is franchise retailers who require: (1) offline-first operations (cashiers, stock managers), (2) hybrid deployments that optionally sync to Supabase, and (3) a maintainable developer workflow that still uses familiar Postgres/Supabase tooling in development.

# Core Features
1. **Local Data Plane (SQLite + API façade)**
   - Provides Products, Families, Clients, Suppliers, Sales, and Inventory tables with RLS-equivalent guardrails enforced in the embedded service.
   - Eliminates Docker/Supabase dependency for offline installs; frontends talk to `http://localhost:8787` using the same REST shape as Supabase PostgREST.
   - Mirrors Supabase column names/types so syncing is deterministic.
   - Offline mode avoids Supabase Edge Functions; use LocalBridge or direct Supabase REST/RPC when online.

2. **Custom Auth & Role Service**
   - Local credential store (bcrypt + per-device secrets) plus role assignments (master, worker, deliverer).
   - Token issuance compatible with Supabase-style JWT claims so existing client guards remain usable.
   - Optional link to Supabase Auth for hybrid deployments; no Edge Functions are required for auth flows.

3. **Sync Engine (Optional)**
   - Bi-directional sync job (local worker) that batches mutations from SQLite to Supabase and back (no Edge Functions).
   - Conflict resolution rules (last-write-wins for inventory counts, append-only logs for sales).
   - Manual "Sync Now" UI plus background timers when connectivity resumes.

4. **Offline-Mode UI & Diagnostics**
   - Worker dashboard surfaces connectivity state (Local Only / Hybrid / Cloud) and shows when the last sync succeeded.
   - Dedicated settings screen for exporting/importing the local DB, resetting auth, and generating support bundles.

# User Experience
- **Personas**: (a) Master/Store Owner configuring stores, (b) Worker/Cashier selling products, (c) Field Technician installing the app on air-gapped machines.
- **Key Flows**:
  1. Technician runs "Retail Manager Offline Installer" → seeds master account → launches Electron app pointing to the embedded backend.
  2. Worker logs in locally, creates products/families, records sales even without internet, sees "Local Mode" badge.
  3. When internet returns, master triggers "Sync to Cloud"; pending rows upload to Supabase and downstream mobile dashboards refresh.
- **UX Considerations**: keep existing modules visually consistent but surface state (offline/online) and sync progress; provide graceful fallbacks when Supabase APIs are unreachable.
</context>
<PRD>
# Technical Architecture
- **System Components**:
  1. Electron shell (existing Vite React app) configured to call `LocalBridge API` instead of Supabase when `process.env.APP_MODE !== 'cloud'`.
  2. `LocalBridge API` (Node/TypeScript + Fastify/Express) bundling:
     - SQLite database using Prisma/Drizzle for schema parity.
     - Auth service issuing JWTs with Supabase-compatible claims (`aud`, `sub`, `role`).
     - Sync worker that talks to Supabase REST/RPC endpoints when available.
  3. Supabase cloud (Postgres + Auth) remains source of truth for hybrid installs; migrations stay in `frontend/supabase/migrations` and double-generate SQLite schema.
- **Data Models**: reuse Supabase tables (products, product_families, sales, sale_items, suppliers, user_roles, stores). Additional meta tables: `sync_log`, `pending_mutations`, `device_keys`.
- **APIs/Integrations**:
  - Local REST endpoints mimic Supabase RPCs (`POST /rpc/worker_create_product`, `/rest/v1/products`).
  - Sync worker uses Supabase Service Key stored securely on master devices (with option to disable).
- **Infrastructure**:
  - Local mode: bundled Node binary + SQLite file stored under `%APPDATA%/RetailManager/offline.db` (Windows) or `~/Library/Application Support/RetailManager` (macOS).
  - Dev mode: Docker-based Supabase remains for CI; local backend can run via `npm run backend:dev` for integration tests.

# Development Roadmap
- **Phase 0 · Foundations**
  - Schema mirror: generate SQLite migrations from Supabase SQL.
  - Stub LocalBridge API with auth, products CRUD, worker_create_product parity.
  - Add env-driven client switch (Supabase vs LocalBridge).
- **Phase 1 · Core Offline Ops (MVP)**
  - Implement products, families, suppliers, sales CRUD locally.
  - Embed LocalBridge in Electron build; provide local installer scripts.
  - Basic offline auth (master bootstrap + worker provisioning) with encrypted local storage.
- **Phase 2 · Hybrid Sync**
  - Pending-mutation queue, resumable sync, last-sync metadata.
  - Conflict resolution strategies + admin-facing logs.
  - UI hooks for "Sync Now" and connectivity indicators.
- **Phase 3 · Advanced Features**
  - Background service (Windows Service / macOS LaunchAgent) to keep LocalBridge alive.
  - Telemetry + health reporting.
  - Optional remote management (ship logs, remote config) when internet exists.

# Logical Dependency Chain
1. **Foundation**: schema parity, local API scaffold, env gating in frontend (must land before swapping data sources).
2. **Visible MVP**: product creation/listing in LocalBridge so workers can demo offline; ensure existing UI works unchanged.
3. **Progressive Enhancements**: add modules (sales, suppliers) incrementally, each with sync hooks once stable.
4. **Hybrid Sync**: only after local CRUD is battle-tested; prioritize deterministic mutation logs to avoid data loss.
5. **Background Services & Tooling**: build installer scripts and monitoring last once functionality is complete.

# Risks and Mitigations
- **Scope Explosion**: replacing Supabase entirely is huge; mitigate by keeping SQL schema identical and routing through a compatibility layer.
- **Auth Security**: storing secrets offline introduces risk; use OS keychain/DPAPI for master credentials and rotate device keys.
- **Data Divergence**: sync conflicts could corrupt inventory; enforce append-only logs and provide manual reconciliation UI.
- **Maintenance Overhead**: dual backends (Supabase + LocalBridge) could drift; automate schema generation (Supabase SQL → SQLite migration) and add CI checks.

# Appendix
- Research: Supabase offline mirroring guides, Prisma SQLite support, Windows Service installers.
- Specs: expected local API contract documented in `docs/local_bridge_api.md` (to be authored next); installer requirements for Windows/macOS.
</PRD>
