# PRD-014 — Offline→Online Sync MVP (Store-First, Mali-Ready)

## 1) Goal

Build a **hybrid offline-first architecture** where each store keeps working fully offline, and data syncs to cloud whenever connectivity is available.

This enables:
- Local reliability in low/unstable connectivity zones
- Owner visibility across stores when online
- Remote backup and multi-device continuity

---

## 2) Scope (MVP)

### In scope
- Sales sync (header + line items)
- Products stock sync (quantity + pricing updates)
- Clients and client services sync
- Purchase orders sync (header + items)
- Users/stores metadata sync
- Conflict detection + deterministic resolution
- Retry-safe sync with idempotency
- Audit trail for sync operations

### Out of scope (Phase 2+)
- Real-time WebSocket collaboration
- Full media sync (images/files)
- Complex merge UI for non-technical users

---

## 3) High-Level Architecture

### Local side (already present)
- Tauri desktop app
- Local SQLite (source of truth while offline)
- Local bridge API (`backend/local-bridge`)

### Cloud side (new)
- Cloud API (Node/Fastify recommended for parity)
- Cloud Postgres database
- Tenant/store auth service (JWT)

### Sync model
- **Outbox pattern** locally: every mutation writes to business table + `sync_outbox`
- Background sync worker pushes pending operations to cloud
- Cloud acknowledges with version/state
- Local app pulls remote changes via incremental cursor

---

## 4) Data Model Additions

### Local SQLite additions

#### `sync_outbox`
- `id TEXT PRIMARY KEY`
- `store_id TEXT NOT NULL`
- `entity_type TEXT NOT NULL` (sale, sale_item, product, client, client_service, purchase_order, purchase_item)
- `entity_id TEXT NOT NULL`
- `op_type TEXT NOT NULL` (create, update, delete)
- `payload_json TEXT NOT NULL`
- `base_version INTEGER`
- `created_at TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'pending'` (pending, sent, acked, failed)
- `retry_count INTEGER NOT NULL DEFAULT 0`
- `last_error TEXT`
- `idempotency_key TEXT NOT NULL`

Indexes:
- `(store_id, status, created_at)`
- `(idempotency_key)` unique

#### `sync_state`
- `store_id TEXT PRIMARY KEY`
- `last_push_at TEXT`
- `last_pull_cursor TEXT`
- `last_success_at TEXT`
- `last_error TEXT`

#### Versioning columns (on synced entities)
Add to each synced table:
- `version INTEGER NOT NULL DEFAULT 1`
- `updated_at TEXT NOT NULL`
- `deleted_at TEXT NULL`

> Use additive migrations only (`ensureColumn` pattern). No destructive migration.

### Cloud Postgres additions

For each synced entity table:
- `store_id UUID/TEXT NOT NULL`
- `version BIGINT NOT NULL DEFAULT 1`
- `updated_at TIMESTAMPTZ NOT NULL`
- `deleted_at TIMESTAMPTZ NULL`

Global change log table:

#### `sync_changes`
- `id BIGSERIAL PRIMARY KEY`
- `store_id TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT NOT NULL`
- `op_type TEXT NOT NULL`
- `version BIGINT NOT NULL`
- `changed_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Indexes:
- `(store_id, id)` for incremental pull

---

## 5) Sync API Contract (Cloud)

Base: `/api/v1/sync`

### 5.1 Push operations
`POST /api/v1/sync/push`

Request:
- `store_id`
- `device_id`
- `operations[]`
  - `idempotency_key`
  - `entity_type`
  - `entity_id`
  - `op_type`
  - `base_version`
  - `payload`
  - `client_updated_at`

Response:
- `results[]` per operation
  - `idempotency_key`
  - `status` (acked, conflict, rejected)
  - `server_version`
  - `server_entity` (optional for conflict)
  - `error_code`

### 5.2 Pull changes
`GET /api/v1/sync/pull?store_id=...&cursor=...&limit=500`

Response:
- `changes[]` ordered by `sync_changes.id`
- `next_cursor`

### 5.3 Handshake/capabilities
`GET /api/v1/sync/handshake`

Response:
- `server_time`
- `min_supported_client`
- `feature_flags`

---

## 6) Conflict Resolution Rules (MVP)

Use deterministic rules to avoid manual merge in MVP.

1. **Immutable financial events (sales, sale_items, purchase_items):**
   - No overwrite after commit
   - If duplicate by `external_ref`/idempotency => ignore as already applied

2. **Master data (products, clients, services):**
   - Version check required
   - If `base_version == server_version`: accept update and increment version
   - Else conflict => server wins by default + return server entity to client

3. **Stock updates:**
   - Never trust absolute overwrite from stale client
   - Prefer event-based stock movement application
   - If absolute quantity update is required, enforce fresh version

4. **Deletes:**
   - Soft delete only (`deleted_at`)
   - Tombstones replicated via pull

---

## 7) Security Model

- JWT required for every sync call
- Claims must include `user_id`, `store_scope`, `role`
- Worker tokens restricted to assigned store(s)
- Rate-limit sync endpoints per device + store
- Encrypt transport (HTTPS only)
- Optional payload signature with HMAC for tamper detection in later phase

---

## 8) Reliability Requirements

- All push operations idempotent by `idempotency_key`
- Exponential backoff retries: 15s, 30s, 60s, 2m, 5m (cap)
- Circuit breaker if repeated auth/4xx failure
- Sync worker must never block POS transaction flow
- Local commit first, cloud sync second

---

## 9) Implementation Plan (4 Weeks)

### Week 1 — Foundation
- Add local sync tables (`sync_outbox`, `sync_state`)
- Add version columns to synced entities
- Emit outbox events from create/update/delete services
- Create cloud project scaffold + Postgres schema

### Week 2 — Push MVP
- Implement `/sync/push` with idempotency table/cache
- Implement server apply logic per entity
- Return per-operation status and conflict payload
- Add local sync worker (push only)

### Week 3 — Pull MVP
- Implement `sync_changes` producer in cloud
- Implement `/sync/pull` cursor API
- Apply remote changes locally in deterministic order
- Add basic conflict logs in UI diagnostics panel

### Week 4 — Hardening + Pilot
- Add retry/backoff + failure telemetry
- Add auth edge-case handling and token refresh
- Pilot with 2–3 stores
- Measure sync lag, conflict rate, and failed operations

---

## 10) Acceptance Criteria (MVP)

1. Store can process sales fully offline for 48h and sync later without data loss.
2. Duplicate push attempts do not create duplicate sales/purchases.
3. Two devices editing same product produce deterministic outcome and conflict log.
4. Owner can see consolidated cloud dashboard after sync.
5. No blocking impact on local checkout latency.

---

## 11) Recommended Hosting Path

### Start now (lowest complexity)
- 1 VPS (2 vCPU / 4GB RAM)
- Dockerized API + Postgres + Caddy/Nginx
- Daily managed backup + object storage dump

### Provider recommendation
- **Option A (easy management):** Hostinger VPS
- **Option B (best price/perf):** Hetzner Cloud
- **Option C (developer-friendly ecosystem):** DigitalOcean

Pick based on your operational comfort, not marketing pages. For current stage, any of the three is enough.

---

## 12) Mali GTM Link to Architecture

- Keep offline as default product promise
- Sell internet sync as paid add-on tier:
  - Offline Basic
  - Offline + Cloud Backup
  - Offline + Full Multi-Store Sync

This lets low-income clients start cheap while higher-value clients fund your cloud roadmap.

---

## 13) Immediate Engineering Tasks (Next 5 Days)

1. Create migration for `sync_outbox` and `sync_state` in local bridge
2. Add `version/updated_at/deleted_at` to products/clients/sales tables
3. Implement outbox writer in repositories (sales, products, clients)
4. Create cloud Fastify skeleton with `/sync/handshake` + `/sync/push`
5. Add a hidden “Sync Diagnostics” panel for admins (queue length, last error, last success)

---

## 14) Pricing Packaging Guidance

- Keep 40k CFA as **entry acquisition** only
- Add cloud sync as premium upsell once stable
- Charge monthly for cloud sync + backup + support

The strategic win is recurring revenue, not only one-time installation.
