# Technical Context - Retail Manager

*Last updated: 2026-07-13*
*Canonical core file. Consolidates and supersedes `core/context/techContext.md` (kept for history).*

## Technology Stack
- **Frontend**: React + Vite + TypeScript, Tailwind CSS, Shadcn UI, Zustand (stores),
  i18next (fr/en/bm). Lives in the `retail-manager-stores` submodule (`src/`).
- **Desktop Wrapper**: Tauri v2 (`@tauri-apps/cli ^2.2.0`), migrated from Electron. Rust core in
  `src-tauri/` (`tauri.conf.json` app version `0.2.5`).
- **Local Backend**: Node.js (Fastify) in `backend/local-bridge/`, bundled as a **Tauri sidecar**.
- **Local Database**: SQLite via `better-sqlite3` (WAL mode, PRAGMA tuning). FTS5 for search.
- **Cloud Database**: Supabase (PostgreSQL) as the canonical sync hub (optional plane).
- **Sidecar packaging**: `backend/sidecar-wrapper` (Rust, `zip` crate) — self-extracting Node 18 (x86).
- **Web deploy**: `retail-manager-stores` also ships to **Vercel** (`vercel.json`, framework `vite`).

## Versions (current)
- Root `retail-manager-root`: **1.0.0** (Tauri shell / build orchestrator).
- `src-tauri` app: **0.2.5**.
- `retail-manager-stores` (frontend, internal name `retail-manager`): **0.5.5**.
- `retail-manager-restaurant` (`restomanager`): root **0.5.31**, frontend **0.5.5**.

## Backend Layout (`backend/local-bridge/src/`)
- `index.ts` (Fastify bootstrap + route registration), `env.ts` (cross-platform data-dir resolution),
  `scheduler.ts` (offline auto-order cron on startup), `seed.ts`.
- `db/` — `connection.ts`, `schema.ts`, `migrations.ts`, `types.ts`, `index.ts` (barrel) and
  `db/repositories/*.repo.ts` (~19 domain repositories + `sync_helpers.ts`).
- `routes/` — REST endpoints per domain (auth, products, sales, purchasing, deliveries, analytics,
  audit, stores, sync, team, invitations, system, emergency, clients).

## Architecture: Hybrid Offline-First
Dual-plane data strategy:
1. **Local Plane** — the LocalBridge sidecar + SQLite: instant, fully offline operations (source of
   truth for the POS).
2. **Cloud Plane** — Supabase: canonical sync hub for multi-store visibility, backup, remote continuity
   (PRD-014 outbox/inbox sync, partially implemented via `sync_outbox` + `sync_helpers`).

## Hardware Constraints
- **CPU**: Intel Dual-Core ~2.5 GHz. **RAM**: ~2.5 GB. **OS**: Windows 10 / macOS.
- **Strategy**: Tauri's small footprint + SQLite-side FTS5 search to minimize RAM; 32-bit Windows target.

## Multi-Platform Build
- **macOS (Apple Silicon)**: `aarch64-apple-darwin`. Run `npm run tauri:build` from root
  (`scripts/build-sidecar.sh` packages `local-bridge-aarch64-apple-darwin`; frontend built from
  `retail-manager-stores`).
- **Windows 32-bit**: `i686-pc-windows-msvc`, built inside a **Windows 11 ARM VM (Parallels)** with
  Visual Studio (VC.Tools.x86.x64 + Windows SDK). Run `.\scripts\build-sidecar.ps1`, then
  `tauri build --target i686-pc-windows-msvc`. See `memory-bank/tech/` build bible and
  `core/context/windows_build_pattern.md`.
- **Dev restore**: after any production build, `cd backend/local-bridge && npm rebuild better-sqlite3`
  to restore the native module for the local Node version.
- **Hardening**: production builds obfuscate both frontend (`vite-plugin-javascript-obfuscator`) and
  the sidecar (`javascript-obfuscator`): string encryption, mangling, control-flow flattening.

## Key References (memory-bank)
- `tech/cross_architecture_build_bible.md` — **CRITICAL** architecture-mismatch guide.
- `tech/sidecar_wrapper_strategy.md`, `tech/dynamic_port_discovery.md`, `tech/windows_arm64_setup.md`.
- `docs/PRD-014-Offline-Online-Sync-MVP.md`, `docs/PRD_split_db_into_repository_modules.md`.
