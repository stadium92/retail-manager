# Progress Tracking - Retail Manager

*Last updated: 2026-07-15*
*Canonical core file. Consolidates and supersedes `core/progress/progress.md` (kept for history).*
*Granular task-by-task tracking lives in `core/tasks.md`.*

## 2026-07-15 additions (see activeContext.md for full detail)
- [x] `fpvrbxmbrotowdlyebqv` (STIHL Dibidani's own Supabase project) given the full `profiles`/
      `user_roles`/`role_audit_log` auth schema it was missing entirely; 3 real pre-existing accounts
      backfilled with profiles/roles/reset passwords.
- [x] `retail-manager`'s Tauri Windows CI build (`build.yml`) fixed (3 real bugs: cross-account
      private-submodule auth, orphaned gitlink, Tauri hook-command path resolution) and confirmed
      **building successfully** end-to-end on `stadium93/retail-manager`.
- [x] New Vercel project `djati-dibidani` stood up for the STIHL web portal, git-linked to
      `mohcly/Djati-stores`, production env vars wired to the correct Supabase project.
- [ ] Vercel "Production Branch" dashboard setting can't be changed via public API — open annoyance,
      not a blocker (CLI `vercel deploy --prod` works around it every time).
- [ ] **New bug, unresolved**: Master-side modules reportedly render empty in the deployed dibidani
      app. Not a branch/file/data-ownership issue (all ruled out) — likely in module code/data-fetching
      itself. `feat/stihl-dibidani-v3` (pure unmodified `main`) deployed to isolate whether this is a
      `main`-inherent bug or dibidani-specific.
- [x] Three dibidani branch variants exist on `Djati-stores` now: `feat/stihl-dibidani` (legacy,
      patched), `feat/stihl-dibidani-v2` (fresh from `main` + templates + stihl Supabase), and
      `feat/stihl-dibidani-v3` (pure `main`, diagnostic). Not yet consolidated into one — pick a
      canonical one once the empty-modules bug is understood.

## Snapshot
- **Branch**: `chore/monorepo-submodules` · **Frontend version**: 0.5.5 · **Tauri app**: 0.2.5 · **Root**: 1.0.0
- **Stage**: mature MVP under active refinement; migrating to a submodule monorepo and preparing
  client-branded (STIHL) deployments and full offline↔online sync.

## Done ✅
- [x] Framework migration Electron → **Tauri v2**.
- [x] Sidecar integration (Node.js LocalBridge) with universal x86/x64/ARM64 support.
- [x] Full i18n (fr / en / bm) across modules.
- [x] **Backend repository refactor**: `db.ts` split into `db/` + ~19 repositories (Phase 8 complete).
- [x] Currency support **GHS** + XOF/EUR/USD with dynamic denominations.
- [x] **Stock valuation fix** (COALESCE/CAST, carton multiplier).
- [x] **Product-family fix** (Master store-scoped selector + persisted `category_id`).
- [x] **Client Service & auto-discount** (tables, repos, routes, POS wiring, credit balances).
- [x] Keyboard shortcuts (PRD-013), FTS5 search, licensing/activation, supplier settlements.
- [x] Packaging price/stock math; POS delete (keyboard); DB repair/integrity tooling.
- [x] Windows 32-bit build via Rust self-extracting sidecar; frontend + sidecar obfuscation.
- [x] **Monorepo/submodule consolidation** (stores + restaurant submodules; mobile retired).

## In Progress 🚧
- [ ] **PRD-014 Offline→Online Sync**: `sync_outbox` + `sync_helpers` + `cash` repos scaffolded;
      version columns, cloud `/sync/*` endpoints, idempotency/conflict rules, background worker, and
      admin diagnostics still to complete and validate (48h-offline pilot).
- [ ] **EditionModule.tsx / SalesModule.tsx refactor** — reports + POS hardening in `retail-manager-stores`.
- [ ] **STIHL client-branded builds** — per-dealer branches maintained, not yet merged to `main`.
- [ ] **Backend security re-audit** against refactored routes/repositories.

## Backlog / Planned 📋
- [ ] Smart Replenishment (PRD-004), Multi-Price Tiers & Batch Tracking (PRD-005),
      Packaging deduction fixes (PRD-006).
- [ ] Edge-AI sales/inventory insights (activates after ~1 month of data).
- [ ] Deliverer & Customer interfaces maturation; GPS delivery tracking.

## Known Risks
- Branch divergence across many `fix/*`, `copilot/*`, and STIHL branded branches → drift risk.
- Sync conflict handling unproven at scale until the PRD-014 pilot completes.
- Anti-theft guarantees depend on the backend security re-audit landing.
