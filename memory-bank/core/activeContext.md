# Active Context - Retail Manager

*Last updated: 2026-07-13*
*Canonical core file. Consolidates and supersedes `core/context/activeContext.md` (kept for history).*

## Current State (grounded in the repo)
- **Branch**: `chore/monorepo-submodules` (default/main lineage). Working tree has the
  `retail-manager-stores` submodule pointer modified; untracked `docs/FINANCIAL_STRATEGY.md`,
  `.vercel/`, `testsprite_tests/`.
- **Versions**: root `1.0.0`, Tauri app `0.2.5`, `retail-manager-stores` frontend `0.5.5`,
  `retail-manager-restaurant` `0.5.31`.
- **Recent commits** center on the **monorepo/submodule consolidation** — folding the mobile,
  restaurant, and stores apps into nested git submodules and retiring `retail-manager-mobile`
  (`46804fb`, `6545b47`, `827b77c`), on top of a long run of inventory/purchase/analytics/stock-threshold
  stabilization "sync" commits.

## Current Focus
- **Monorepo hygiene**: finish the submodule restructure (stores + restaurant as submodules), keep
  `.gitmodules` and submodule pointers consistent, ensure the Tauri build still consumes
  `retail-manager-stores` as the frontend.
- **EditionModule.tsx / SalesModule.tsx refactor** (in `retail-manager-stores/src/components/worker/Modules/`):
  hardening the reports (Edition) and POS (Sales) modules — invoice lists, purchase reports,
  packaging/price scaling, keyboard delete, client auto-discount.
- **STIHL / client-branded builds**: maintaining per-dealer branches
  (`feat/stihl-dibidani`, `feat/stihl-niamakoro`, `feat/stihl-centenary-edition`,
  `feat/moe-stihl-templates`, `feat/niamanan-dubai`) that diverge from `main` for branded deployments.
- **Offline→Online sync (PRD-014)**: outbox scaffolding exists (`sync_outbox.repo.ts`,
  `sync_helpers.ts`, `cash.repo.ts`); wiring push/pull, conflict rules, and the background worker is the
  next big chunk.

## Recently Completed
- **db.ts repository refactor (Phase 8) — DONE**: monolithic `db.ts` removed; replaced by
  `db/{connection,schema,migrations,types,index}.ts` + ~19 `db/repositories/*.repo.ts`.
- **Currency support**: GHS added alongside XOF/EUR/USD (`useSettingsStore`, `currencyConfig.ts`,
  `CurrencySwitcher`, dynamic denominations; removed hardcoded XAF suffixes).
- **Stock valuation fix**: `getStockValuation` uses `SUM(CAST(quantity)*CAST(cost_price))` with
  COALESCE/CAST null resilience; carton/box multiplier logic respected.
- **Product-family fix**: Master family selector passes the selected `store_id` (global view queries
  all families); family updates persist (`category_id` sent in update payload).
- **Client Service & auto-discount**: `clients` + `client_services` tables, repos, `routes/clients.ts`
  CRUD+payments, POS auto-discount, stock deduction on sale, credit-balance tracking, i18n.
- **Keyboard shortcuts (PRD-013)**, **FTS5 search**, **licensing/activation**, **supplier settlements**,
  **packaging price/stock math**, **fr/en/bm translation audits**, **DB repair tooling** — all landed.

## Current Blockers / Open Threads
- **PRD-014 sync not finished**: version columns on synced entities, cloud API endpoints
  (`/sync/handshake|push|pull`), idempotency/conflict resolution, background worker, and admin
  diagnostics remain to implement/verify.
- **Branch divergence**: many client/fix branches (STIHL variants, `fix/*`, `copilot/*`) not yet merged
  to `main` — risk of drift across branded deployments.
- **Backend security hardening**: earlier audit flagged cross-store exposure / non-atomic writes in
  sales/products routes to keep verifying against the anti-theft mandate.

## Next Steps
1. Land PRD-014 sync MVP end-to-end (outbox → cloud → pull/reconcile) and add the diagnostics panel.
2. Complete the Edition/Sales module refactor and verify parity across retail/wholesale/proforma.
3. Reconcile/merge stabilized fix branches into `main`; keep STIHL branded branches rebased.
4. Re-run the backend security audit against the refactored repositories.

## Technical Decisions Carried Forward
- **Base-unit stock**, **line-level auto-discount with override**, **backend-side stock deduction**,
  **English-only logs**, **Rust self-extracting sidecar**, **one action per F-key**.
