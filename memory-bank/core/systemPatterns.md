# System Patterns - Retail Manager

*Last updated: 2026-07-13*
*Canonical core file. Consolidates and supersedes `core/context/systemPatterns.md` (kept for history).*

## Repository / Deployment Topology (current)
- **Monorepo with git submodules** (branch `chore/monorepo-submodules`):
  - Root `retail-manager-root` (v1.0.0) — Tauri v2 shell (`src-tauri/`, conf v0.2.5) + the
    `backend/local-bridge` sidecar + `backend/sidecar-wrapper` (Rust self-extracting launcher).
  - `retail-manager-stores` submodule — the React/Vite frontend (`src/`), also Vercel-deployable.
  - `retail-manager-restaurant` submodule — restaurant variant.
  - The older `retail-manager-mobile` submodule was retired and folded into stores (commit `46804fb`).
- **Client-branded release branches**: `feat/stihl-dibidani`, `feat/stihl-niamakoro`,
  `feat/stihl-centenary-edition`, `feat/moe-stihl-templates`, `feat/niamanan-dubai` — per-dealer
  branded builds diverging from `main`.

## Architecture Patterns
- **Tauri Sidecar Pattern**: The Node.js `local-bridge` (Fastify) is compiled to a platform-specific
  binary and launched by the Tauri Rust core, isolating business logic from the UI thread and keeping
  memory low.
- **Rust Self-Extracting Launcher**: `backend/sidecar-wrapper` embeds a zipped Node 18 (x86) runtime +
  app bundle and extracts it at runtime — replacing the deprecated `pkg` approach for 32-bit Windows.
- **Repository Pattern (backend)**: The former monolithic `db.ts` (~2,193 lines) is now split into
  `backend/local-bridge/src/db/` — `connection.ts`, `schema.ts`, `migrations.ts`, `types.ts`,
  `index.ts` (barrel) — plus ~19 factory-function repositories under `db/repositories/`
  (`auth`, `stores`, `products`, `sales`, `purchasing`, `suppliers`, `clients`, `client_services`,
  `deliveries`, `inventory`, `analytics`, `scheduling`, `replenishment`, `invitations`, `audit`,
  `sync`, `sync_outbox`, `cash`, + `sync_helpers`). The barrel preserves `db.db` (raw handle),
  `db.initialize()`, and `db.dbFile`.
- **Adapter / Offline-Service layer (frontend)**: services such as `OfflineDataService`,
  `OfflineInventoryService`, `OfflineAuthService`, `LocalDatabase`, and `LocalBridgeSyncService`
  abstract the local-bridge vs. cloud data source.
- **Delta / Outbox Sync (in progress)**: `sync_outbox` table + `sync_helpers` implement the PRD-014
  outbox/inbox journal so changes (not full state) are pushed/pulled with idempotency keys.

## Interaction Patterns
- **Thin Client**: The React frontend is a view layer over SQLite, fetching windowed data to keep DOM
  and memory usage low.
- **Context-Aware Keyboard Shortcuts**: Global `keydown` listener via `ShortcutsContext` intercepts
  F1–F12 based on the active module (F2 Validate, F4 Payment, F10 Print, Delete removes selected row).
- **Retro-DOS Help System**: F1 opens a high-contrast, text-heavy overlay (`ShortcutsHelpOverlay`).

## Data Patterns
- **Base-Unit Inventory**: Stock is always stored in base units; "Box/Carton" is a UI abstraction —
  selling a Carton deducts `quantity * pack_size`. Stock valuation respects the store's unit convention.
- **FTS5 Searching**: SQLite full-text virtual table for instant product lookup on low-end hardware.
- **Optimistic UI**: Immediate local updates, background sync.
- **English-Only Audit Logging**: All technical/audit events recorded in English (with `severity`
  INFO/WARN/ERROR and `app_version`) for cross-locale debugging and AI-assisted RCA.
- **Auto-Discount at line level**: Client-group `default_discount_percent` applied per line in the POS,
  with manual override.

## System Stability & AI Safety Protocols (Windows VM builds)
To prevent bricking the Parallels dev environment, AI agents must obey these **Strict Negative
Constraints**:
1. **NEVER disable core services** (`Netman`, `nlasvc`, `Dhcp`, `Dnscache`, `BFE`, hardware, Parallels).
2. **No driver/service deletion** (`sc delete` forbidden).
3. **Network integrity** — do not `Disable-NetAdapter`; the Mac↔VM bridge is mission-critical.
4. **Safe space optimization only** — delete `dist/`/`target/`/`node_modules/`, Disk Cleanup, or
   recommend Parallels "Compress Disk" (manual).
5. **Persistence protection** — do not touch `HKLM\SYSTEM\CurrentControlSet\Services` without explicit
   confirmation.
Prioritize stability over incremental disk-space gains.
