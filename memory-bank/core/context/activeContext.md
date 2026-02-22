# Active Context - Retail Manager

## Current Focus
Completed the **Client Service & Discount Logic** implementation.
- Backend: Added `clients` and `client_services` tables, repos, and routes.
- Frontend: Wired Client/Group modules to API, implemented Auto-Discount in POS.
- Integrity: Added stock deduction and client balance tracking to Sale creation.

## Current Blockers
- **Legacy `db.ts` Cleanup:** The monolithic `db.ts` still exists alongside the new repositories. Phase 8 needs to be fully finalized (deleting `db.ts`) after ensuring all legacy dependencies are migrated.

## Recent Changes
- **Client Service Implementation:**
    - Created `clients` and `client_services` tables in SQLite.
    - Implemented `clients.repo.ts` and `client_services.repo.ts`.
    - Created `routes/clients.ts` with full CRUD and payment endpoint.
    - Updated `SalesModule.tsx` to auto-apply discounts from client groups.
    - Updated `OfflineSalesService` and backend sales route to handle `client_id` and stock deduction.
    - Added translations for new features.
- **Tauri Build Success:** Successfully built `retail-manager_0.1.0_x86_en-US.msi` targeting `i686-pc-windows-msvc`.
- **Configuration Recovery:** Re-created missing `tauri.conf.json`, `Cargo.toml`, and generated icons using `npx tauri icon`.
- **Code Fixes:** Patched `src-tauri/src/lib.rs` for `tauri-plugin-log` v2 compatibility.
- **Windows Sidecar Strategy Pivot**: Abandoned `pkg` for Windows 32-bit builds due to missing upstream binaries and deprecation.
- **Rust Sidecar Wrapper**: Implemented a custom Rust executable (`backend/sidecar-wrapper`) that embeds a zipped Node.js 18 (x86) environment and extracts it at runtime.

## Next Steps
- **Verify Client Features:** Test client creation, group assignment, and POS auto-discount.
- **Verify Stock Deduction:** Ensure stock drops after a sale.
- **Finalize db.ts Refactor:** Complete Phase 8 by removing `db.ts` (if safe).
- **Commit Code:** Commit changes to git.

## Technical Decisions
- **Mirroring Supplier Pattern:** Client backend implementation strictly mirrors the Supplier architecture for consistency.
- **Auto-Discount:** Discount is applied at the line-item level in the POS, allowing for manual overrides.
- **Stock Deduction in Backend:** Moved stock deduction logic to the backend sales route for better integrity.
- **Rust Wrapper for Sidecar**: Adopted a "Self-Extracting Launcher" pattern using Rust (`zip` crate) to package the Node.js backend. This provides full control over the runtime environment and avoids external dependency failures (like `pkg` 404s).
- **One Action Per Key**: Updated mapping logic to ensure an action is only assigned to one function key at a time.
- **English-Only Logs**: All technical/audit logs remain in English for developer debugging.