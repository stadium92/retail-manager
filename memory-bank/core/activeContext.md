# Active Context - Retail Manager

*Last updated: 2026-07-15*
*Canonical core file. Consolidates and supersedes `core/context/activeContext.md` (kept for history).*

## Status Update — 2026-07-15 (dibidani/Supabase/CI/Vercel session)

**Two Supabase projects now confirmed in play**: `onsqvduklnwffugsiybs` (shared, used by
`Djati-stores` `main`) and `fpvrbxmbrotowdlyebqv` ("the stihl store" — the STIHL Dibidani
client's own dedicated project, live production data: 278 products, 1 store/company/worker/sale).
These are separate physical databases, not git branches of one project.

- **`fpvrbxmbrotowdlyebqv` schema reconciled with main's auth model**: it had no `profiles`/
  `user_roles`/`role_audit_log` tables at all (only legacy `companies`/`workers`, unused by current
  app code) — meaning every login was silently failing past the auth step. Created the full set
  (tables + `has_role`/`get_user_stores`/`assign_role_from_email`/`auto_assign_role_on_profile_create`/
  `log_role_assignment` functions + triggers + RLS policies, RLS left disabled to match main's actual
  live state), sourced by live-introspecting `onsqvduklnwffugsiybs` (not by trusting migration files,
  which can drift from live state). Backfilled 3 pre-existing `auth.users` accounts that predated the
  fix (`madjousylla@gmail.com`→master, `bahsyllah223@gmail.com`/`imsnsylla@gmail.com`→worker) with
  profiles + passwords reset to `12345678@`. Store's `owner_id` is still NULL (flagged, not yet
  fixed — user confirmed this is not the cause of a separate "Master modules look empty" symptom
  currently under investigation).
- **`Djati-stores`' own `feat/stihl-dibidani` branch** (repo `mohcly/Djati-stores`, NOT a branch of
  `onsqvduklnwffugsiybs`'s `main`) had a mismatched Supabase project-ID typo in `AIService.ts` fixed,
  matching the fix already on `main`.
- **CI (Tauri Windows build)**: `retail-manager`'s `.github/workflows/build.yml` had three real bugs
  blocking it, all fixed on `feat/stihl-dibidani`: (1) default `GITHUB_TOKEN` can't check out the
  private cross-account `Djati-stores` submodule — added a `SUBMODULE_PAT` secret + split submodule
  checkout into its own step; (2) an orphaned `frontend_backup` gitlink (mode 160000, no `.gitmodules`
  entry) broke `submodule update --init --recursive` outright; (3) `tauri.conf.json`'s
  `beforeDevCommand`/`beforeBuildCommand` need `Djati-stores` (no `../`) since Tauri runs those as
  shell commands from repo root, not from `src-tauri/` — `frontendDist` correctly keeps `../Djati-stores/dist`
  since path *fields* resolve relative to the config file, unlike command *hooks*. **Built successfully**
  on `stadium93/retail-manager` (a repo the user pushed this branch to specifically to use that
  account's `windows-latest` Actions runner — earlier concern about a new-account runner hold turned
  out to be resolved/not applicable). Artifact at that repo's Actions run history.
- **Vercel**: new project `djati-dibidani` (team `mohclys-projects`) serves the STIHL web portal.
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set as `sensitive`-type production env vars pointing at
  `fpvrbxmbrotowdlyebqv` — sensitive vars can't be pulled locally (`vercel pull` returns empty), so
  deploys MUST use `vercel deploy --prod` (remote build) rather than `--prebuilt` after a local build.
  GitHub App authorization for Vercel↔`mohcly/Djati-stores` got resolved mid-session (was blocked
  earlier). **The dashboard's "Production Branch" setting could not be changed via the public API** —
  every method tried (PATCH variants, re-link, disconnect+reconnect) silently reverts it to `main`;
  best-effort read is that Vercel derives it from GitHub's actual default branch and doesn't expose
  full override via the public REST surface. Workaround in active use: `vercel deploy --prod` from
  whichever branch's worktree, which ignores that setting entirely and always deploys to production.
- **Three dibidani branch variants now exist** on `Djati-stores` (repo `mohcly/Djati-stores`):
  `feat/stihl-dibidani` (the original/legacy line, patched per above), `feat/stihl-dibidani-v2`
  (fresh fork from `main` + ported standalone invoice/ticket HTML templates from the legacy branch
  + Supabase repointed to `fpvrbxmbrotowdlyebqv`), `feat/stihl-dibidani-v3` (pure unmodified `main`
  checkout, no code changes — deployed as-is to diagnose whether an "empty Master modules" symptom
  the user is seeing is inherent to `main` itself or specific to the dibidani lineage). All three have
  been deployed to `djati-dibidani`'s production alias at different points this session for comparison.
- **Open bug, unresolved**: user reports Master-side modules appear empty in the deployed app. Ruled
  out: wrong branch checkout (verified `main` is a real ancestor... at time of v2's creation), missing
  files (all `src/pages/master/*.tsx` present), store-ownership/data (`owner_id` fix was proposed but
  user said that's not it — "it is not about the stores owners, but the code in the modules, they look
  empty"). Still needs a fresh look, likely in the actual Master module component code/data-fetching
  logic itself — v3 (pure `main`) is deployed specifically to test this.
- **Concurrent-session note**: another Claude Code session/agent was independently active on this same
  `retail-manager` repo during this period (observed: main checkout branch changed unprompted, new
  worktrees appeared under `.claude/worktrees/` that weren't created here, a commit landed on
  `feat/stihl-dibidani` mid-session with the exact CI fixes this session was about to make
  independently). No conflicts arose, but be aware of this when reasoning about "who changed what."

## Status Update — 2026-07-15 (this is the other concurrent session referenced above — Djati-stores
legacy-restore, monorepo main promotion, auth/sync/mobile-UI fixes)

- **`Djati-stores` (repo `mohcly/Djati-stores`, submodule of this repo) had its `main` branch entirely
  replaced** with a more complete "legacy" codebase recovered from the old standalone
  `retail-manager-mobile` repo, per explicit user direction after confirming it had working login/sales/
  full sidebar that the prior `main` lacked. Old `main` preserved as `main-pre-legacy-restore` (not
  deleted). This repo's `retail-manager-stores` submodule pointer/URL updated to match
  (`retail-manager-stores` → `Djati-stores` repo rename).
- **`retail-manager`'s own `main` branch promoted from `chore/monorepo-submodules`**: old `main`
  preserved as `main-pre-monorepo-submodules`, pushed to all four GitHub mirrors (`stadium91`/origin,
  `boop-moon`, `stadium92`, `stadium93`), default branch reset to `main` on each.
- **Backend sync-outbox was a dead letter queue**: `sync_outbox` (populated by sales/clients/deliveries/
  stores/cash/products/suppliers/purchase_orders repos via `emitOutbox()`) was never actually read by
  `/sync/push` — only a separate, mostly-unused `pending_mutations` table was drained. Real local-bridge
  client data had no path to Supabase. Fixed: `/sync/push` now drains both, plus a one-time idempotent
  backfill sweep for historical data that predates the fix, triggered automatically on every app launch.
  `clients`/`cash_transactions` Supabase tables don't exist yet (queue correctly, fail cleanly until
  created); team/worker sync intentionally not implemented (needs real Supabase Auth provisioning, not
  a generic push — local-bridge workers only have local bcrypt-hash accounts).
- **Frontend auth/session bugs fixed on `Djati-stores` `main`**: session not persisting across reloads
  for store owners without an explicit `user_roles` row (owner-lookup fallback existed at login but not
  at session-restore); master-password verification always failing in Cloud mode (only checked an
  IndexedDB cache Cloud logins never populate — added a `verify-master-password` Supabase Edge Function);
  password-change silently broken in both modes (was calling a nonexistent endpoint).
- **iOS Safari autofill crash on login** (real client-reported bug, iPhone 11): global `keydown`
  listeners (`ShortcutsContext`, `ScannerContext`, both mounted at the App root, active on `/auth`)
  crashed on `e.key.startsWith(...)`/`e.key.length` when Safari's autofill dispatches synthetic events
  with no `.key` string. Guarded both.
- **Mobile POS/checkout layout redesigned**: `MobilePOS.tsx` used `fixed` header/footer with hardcoded
  pixel-offset magic numbers to coordinate with the parent tab bar — replaced with proper flexbox
  (`h-dvh flex flex-col`, `flex-1 min-h-0 overflow-y-auto` middle). Separately, and more impactfully: the
  **shared `DialogContent`/`AlertDialogContent`/`SheetContent` UI primitives had no `max-height` or
  `overflow-y-auto` at all** (34 call sites across the app) — any dialog taller than the viewport
  (e.g. `CheckoutModal`) overflowed off-screen with the confirm button unreachable, on any device. Fixed
  at the shared-component level (`max-h-[90dvh] overflow-y-auto`), not per-dialog.
- **`feat/stihl-dibidani` and `feat/niamanan-dubai` (`Djati-stores` branches) both wired to build as
  Windows `.exe`s via `retail-manager`'s Tauri CI**, confirmed with real successful `windows-latest`
  builds on `stadium93/retail-manager` (artifacts in that repo's Actions run history). `boop-moon` is
  the historically-proven CI account if `stadium93` ever needs to be avoided.
- **Data-safety fix for `feat/stihl-niamakoro`** (real client already running this build, real
  accumulated local data): removed a `main.tsx` one-time `localStorage.clear()` + full IndexedDB wipe
  gated on a version flag the existing install wouldn't have set — would have forced a jarring
  re-login/cache-wipe on next launch. Real business data lives in local-bridge's SQLite, unaffected
  either way, but the wipe itself served no purpose for a controlled update and was removed outright.

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
