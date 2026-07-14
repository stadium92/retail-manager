# Retail Manager - Implementation Roadmap v1.0 (Detailed)

This document tracks granular progress toward the v1.0 release. All technical logs and internal data remain in English.

---

## 🔄 Status Reconciliation — 2026-07-13

*Added to correct stale checkboxes below without rewriting history. Ground truth from the repo:*

- **Branch**: `chore/monorepo-submodules` (not the STIHL feature branches, which exist separately:
  `feat/stihl-dibidani`, `feat/stihl-niamakoro`, `feat/stihl-centenary-edition`, `feat/moe-stihl-templates`,
  `feat/niamanan-dubai`). Versions: root `1.0.0`, Tauri app `0.2.5`, `retail-manager-stores` frontend `0.5.5`.
- **Repo topology**: now a **monorepo with git submodules** — `retail-manager-stores` (React/Vite frontend,
  also Vercel-deployable) and `retail-manager-restaurant` (restaurant variant). `retail-manager-mobile`
  was retired and folded into stores.
- **Phase 8 (Tasks 30–33: split `db.ts` into repositories) — ✅ COMPLETE.** `backend/local-bridge/src/db.ts`
  no longer exists; it is replaced by `db/{connection,schema,migrations,types,index}.ts` plus ~19
  `db/repositories/*.repo.ts` (auth, stores, products, sales, purchasing, suppliers, clients,
  client_services, deliveries, inventory, analytics, scheduling, replenishment, invitations, audit,
  sync, sync_outbox, cash, + sync_helpers). The unchecked `[ ]` boxes in Phase 8 are stale — treat as done.
- **Phase 10 (Task 35: PRD-014 Offline→Online Sync) — 🚧 PARTIALLY DONE.** `sync_outbox.repo.ts`,
  `sync_helpers.ts`, and `cash.repo.ts` are present (35.1–35.3 scaffolded). Still open: version columns on
  synced entities, cloud `/sync/handshake|push|pull` endpoints, idempotency/conflict rules, background
  worker, admin diagnostics, and the 48h-offline pilot (35.4–35.8).
- **Current focus**: monorepo submodule hygiene, `EditionModule.tsx` / `SalesModule.tsx` refactor
  (`retail-manager-stores/src/components/worker/Modules/`), STIHL client-branded builds, and finishing
  PRD-014 sync. Recently completed: currency GHS/XOF, stock-valuation fix, product-family fix,
  client-service auto-discount.

---

## ✅ Recent Completed (P0)

### 0. Currency Support (Ghanaian Cedis)
*   **Context:** Added support for GHS alongside XOF, EUR, USD.
*   **Tasks:**
    *   [x] **Store Implementation:** Created `useSettingsStore` to manage currency preferences.
    *   [x] **Formatter Update:** Updated `utils/formatting.ts` to handle dynamic currency symbols and decimals.
    *   [x] **UI Integration:** Added `CurrencySwitcher` to Master/Worker dashboards and Settings page.
    *   [x] **Denomination Logic:** Implemented `currencyConfig.ts` for dynamic cash counting and quick payment amounts.
    *   [x] **Refactoring:** Removed hardcoded "XAF" suffixes across POS, Inventory, and Reporting modules.

### 1. Stock Valuation Logic Fix
*   **Context:** Currently reporting 0 total value despite existing inventory.
*   **Tasks:**
    *   [x] **Backend Audit:** Inspect `local-bridge/src/db.ts` for the `getStockValuation` method.
    *   [x] **SQL Correction:** Update query to use `SUM(CAST(COALESCE(quantity, 0) AS REAL) * CAST(COALESCE(cost_price, 0) AS REAL))`.
    *   [x] **Null Resilience:** Implement `COALESCE` and explicit `CAST` to ensure numeric precision and null handling.
    *   [x] **Verification:** Verified DB returns non-zero values for active stores.

### 4. Keyboard Shortcuts Overhaul (PRD-013)
*   **Context:** Rapid POS interaction via F1-F12 keys.
*   **Tasks:**
    *   [x] **Context Provider:** Implement `ShortcutsContext` to track active shortcuts based on the current module.
    *   [x] **Global Listener:** Add window listener in `App.tsx` or `WorkerLayout.tsx` to catch F-keys globally.
    *   [x] **Help Overlay:** Build the retro DOS-style `ShortcutsHelpOverlay` triggered by **F1**.
    *   [x] **POS Wiring:** Map **F2** to Validate, **F4** to Payment, **F10** to Print.
    *   [x] **Dynamic Labels:** Link `SanifereFooter` button text to user settings.
    *   [x] **Verification:** Complete a full sale cycle using only the keyboard.

### 9. SQLite FTS5 Performance
*   **Context:** Instant search for low-end hardware.
*   **Tasks:**
    *   [x] **Virtual Table:** Create an FTS5 virtual table for products in the sidecar.
    *   [x] **Query Refactor:** Update search hooks to use `SELECT ... FROM products_fts WHERE name MATCH ...`.
    *   [x] **Verification:** Verified ultra-fast response using FTS5 MATCH syntax.

---

## 🔴 Phase 1: High Priority - Critical Path (P0)

### 2. Edition Module Restoration (Reports)
*   **Context:** Key business reports are currently non-functional templates.
*   **Tasks:**
    *   [x] **List of Invoices:**
        *   [x] Create `InvoiceListTable` component in `EditionModule.tsx` (Integrated directly).
        *   [x] Connect to `OfflineDataService.getSales` with date range support.
        *   [x] Add "View Details" action to see individual items in an invoice.
    *   [x] **Purchase Tracking (Daily/Period):**
        *   [x] Implement data fetching from `purchase_orders` table.
        *   [x] Add grouping logic to show total spent per day/period.
    *   [x] **Purchase by Family:**
        *   [x] Implement SQL join between `purchase_items` and `products` to group by `category`.
        *   [x] Handle "Unclassified" category for products without a family.
    *   [x] **Verification:** Generate a sale and a purchase, then verify they appear in their respective reports.

### 3. Supplier Settlements Logic
*   **Context:** Payment UI exists but does not currently update supplier balances or record history.
*   **Tasks:**
    *   [x] **State Binding:** Ensure the "Confirm Payment" button triggers the `addPayment` action in `usePurchasingStore`.
    *   [x] **Balance Update:** In `LocalDatabase.ts` (mapped to `db.ts`), implement the atomic transaction: `INSERT payment` AND `UPDATE supplier balance`.
    *   [x] **History View:** Fix the "Payment History" table to pull from the `supplier_payments` table.
    *   [x] **Verification:** Pay a supplier with a 10,000 F balance and verify it drops to 0 F in the "Files" module.

### 5. Licensing & Activation System
*   **Context:** Business protection and store limits.
*   **Tasks:**
    *   [x] **Nag Screens:** Implement the persistent trial banner and "Activation Required" dialog.
    *   [x] **Store Limit Enforcement:** Add logic to the "Create Store" form to block creation if the limit (2) is reached.
    *   [x] **Service Integration:** Created `LicenseService.ts` and integrated with Tauri/Rust backend.
    *   [x] **Hard Activation Gate:** Update the logic to require activation input on the very first launch.
    *   [x] **Brute-Force Protection:** 
        *   Implement a counter for failed attempts.
        *   Limit to 3 attempts per day.
        *   Implement a "Hard Lockout" after 15 total misses, preventing retries until the next calendar day.
    *   [x] **Banner Suppression:** Ensure the `LicenseBanner` is permanently removed only upon successful valid activation.
    *   [x] **Verification:** Trial banner shows correctly and block works when stores >= 2.

---

## 🟡 Phase 2: Medium Priority - Intelligence & Support (P1)

### 6. System Intelligence (Logging)
*   **Context:** English-only technical logs for developer debugging.
*   **Tasks:**
    *   [x] **Schema Update:** Add `severity` (INFO/WARN/ERROR) and `app_version` to the `audit_logs` table in LocalBridge.
    *   [x] **Backend Integration:** Update `insertAuditLog` and `migrate()` logic in `db.ts`.
    *   [x] **Infinite Loading Fix:** Fixed `AuditLogsPage.tsx` with proper error states and date validation.
    *   [x] **Global Logger:** Created `Logger.ts` utility for systematic logging.
        * [x] **Auto-Logging:** Wired `useEffect` in `WorkerLayout.tsx` to log `MODULE_ENTER`.
        * [x] **Technical Event Logging:** Enhance `Logger.ts` to capture low-level system events (database queries, state changes) for remote debugging and AI-assisted Root Cause Analysis.
        * [x] **Verification:** Trigger a manual error and see it appear in the Master "System Logs" screen in English.

### 7. Dynamic Help Center (Master)
*   **Context:** Move from template to Markdown-driven portal.
*   **Tasks:**
    *   [x] **Structure Update:** Moved `helpCenter` to top-level in all translation files for better access.
    *   [x] **Support Form:** Built "Report Bug" form that saves a structured log entry including Hardware ID via `Logger.ts`.
    *   [x] **Verification:** Bug reports now appear in the Audit Logs with severity 'ERROR'.
    *   [x] **Markdown Engine:** Integrate `react-markdown` to render local `.md` files.
    *   [x] **Deep Content Enhancement:** Improved accuracy and depth of documentation (See `planning/help_depth_improvement.md`).

---

## 🟢 Phase 3: UI Polish & Optimization (P2)

### 8. LOSS EXIT UI Polish
*   **Context:** Better user guidance without technical jargon.
*   **Tasks:**
    *   [x] **Intro Text:** Add: "Use this screen to record products that are no longer sellable due to expiration, damage, or theft. This ensures your stock levels remain accurate for accounting."
    *   [x] **Constraint:** Ensure the word "submodule" is NOT used in the text.
    *   [x] **Verification:** Check visibility in `en`, `fr`, and `bm`.

### 10. Code Protection & Obfuscation (Security Hardening)
*   **Context:** Protect intellectual property ("Vibe") and prevent reverse engineering of the licensing logic.
*   **Tasks:**
    *   [x] **Frontend Obfuscation:** Integrated `vite-plugin-javascript-obfuscator` to scramble the React bundle during production builds.
    *   [x] **Sidecar (Backend) Protection:** Implemented obfuscation for the `local-bridge` (Node.js) build pipeline using `javascript-obfuscator`.
    *   [x] **Security Configuration:** Enabled string encryption, variable mangling, and control-flow flattening to maximize deterrence.
    *   [x] **Verification:** Verified that `npm run build` now triggers obfuscation for both layers.

### 11. Windows Deployment (Parallels VM)
*   **Context:** Build 32-bit (.exe) installers for low-end Windows hardware (2.5GB RAM).
*   **Tasks:**
    *   [x] **Windows Build Script:** Created `scripts/build-sidecar.ps1` for PowerShell.
    *   [x] **Script Optimization:** Removed emojis/non-ASCII chars from `.ps1` to prevent Windows encoding parser errors.
    *   [x] **32-bit Target Configuration:** Configured `i686-pc-windows-msvc` target for both sidecar and Tauri.
    *   [x] **C++ Build Tools Setup:** Verified `cargo build` works for `i686-pc-windows-msvc` (Visual Studio 2026 / v143 toolset).
    *   [x] **Sidecar Packaging Strategy (Rust Wrapper):**
        *   [x] Created `backend/sidecar-wrapper` (Rust) to replace deprecated `pkg` tool.
        *   [x] Implemented `payload.zip` embedding for Node.js 18 (x86) + App Bundle.
        *   [x] Compiled `local-bridge-wrapper.exe` for 32-bit Windows.
    *   [x] **First Build Verification:** Run the build inside Parallels Windows VM.
    *   [x] **Installer Testing:** Verify the .exe runs on a 32-bit Windows environment.
    *   [x] **Database Path Fix:** Ensure `env.ts` resolves correct Windows path (`C:\Users\...\AppData\Local`) instead of Linux-style `.local/share`.
    *   [x] **Activation UI Restoration:** Fix missing activation prompt and countdowns (App appears unlocked).
        *   [x] **Locate Missing Component:** Find or recreate `LicenseBanner` which seems to be missing from the project structure.
        *   [x] **Integrate Global Check:** Ensure the license check runs on app startup and blocks usage if expired.
    *   [x] **Cross-Platform Code Commit:** Commit only code changes (no binaries) ensuring compatibility with macOS.

---

## 🟣 Phase 4: Critical Refinement Phase (P0+) - Immediate Action

### 12. Master-Side Family Selection & Worker Context Fix
*   **Context:** The Master dashboard is failing to select product families correctly, and the Master lacks visibility into worker-specific data when viewing a worker's profile.
*   **Tasks:**
    *   [x] **Fix Family Selector (Master Inventory):**
        *   **Deep Dive:** Investigate `frontend/src/components/master/Inventory`. The `FamilySelector` component likely relies on a `storeId` context that is missing or undefined in the Master view (since Master manages *multiple* stores, unlike a Worker who is bound to one).
        *   **Action:** Ensure the `MasterDashboard` or `InventoryPage` explicitly passes the currently selected Store ID to the `FamilySelector`. If `storeId` is null (Global View), the selector must query `SELECT * FROM families` without a `store_id` filter (or show all).
    *   [x] **Worker Context Visibility:**
        *   **Deep Dive:** When a Master selects a worker in the "Team" module (`frontend/src/components/master/Team`), the UI currently shows generic info.
        *   **Action:** Implement a `useWorkerDetails` hook that fetches the specific `store_id`, `role`, and `last_active` status from the `profiles` table.
        *   **UI Update:** Display this context in the "Worker Details" sidebar or modal so the Master knows exactly which store context that worker is operating in.

### 13. Purchases Module UX & Generation Logic Overhaul
*   **Context:** The default view is wrong, and the "Generate Orders" button is broken/ambiguous. The Master needs the same manual control as the Worker.
*   **Tasks:**
    *   [x] **Set Default Tab to "Products to Order":**
        *   **Deep Dive:** Locate `frontend/src/pages/master/Purchases/PurchasesPage.tsx`. The `Tabs` component likely initializes with `defaultValue="history"`.
        *   **Action:** Change the initialization state to `defaultValue="to-order"`. Ensure this persists even after navigating away and back (consider simple `localStorage` persistence).
    *   [x] **Fix "Generate Orders" Widget (Supplier Selection):**
        *   **Deep Dive:** The current `handleGenerateOrder` function likely fails because it tries to auto-assign suppliers or expects a pre-selection that the UI doesn't provide.
        *   **Action:** Refactor the "Generate" button to open a **"Create Order Dialog"** instead of immediately firing an API call.
        *   **Implementation:** Inside this dialog, add a `<Select>` component for **Suppliers** (fetching from `suppliers` table).
        *   **Logic:** The "Generate" button inside the dialog should remain disabled until a specific Supplier is chosen. This mirrors the `Worker/ManualOrder` flow where supplier selection is the prerequisite step.
    *   [x] **Parity with Worker Manual Order:**
        *   **Action:** Review `frontend/src/pages/worker/Purchases/ManualOrder.tsx`. Copy the exact logic for "Add Product -> Select Variant -> Add to Cart" and implement it in the Master's "Products to Order" widget. Ensure the Master can manually override quantities before generating the final Purchase Order.

### 14. Automatic Order Scheduling (Cron/Interval System)
*   **Context:** Clients need to schedule orders (e.g., "Every Sunday" or "Every Month on the 1st"). The current system lacks this granularity.
*   **Tasks:**
    *   [x] **Database Schema Update:**
        *   **Deep Dive:** The `purchase_orders` or a new `scheduled_orders` table needs columns for recurrence.
        *   **Action:** Add `recurrence_type` (daily, weekly, monthly, custom), `recurrence_value` (e.g., 'Sunday', '1'), and `next_run_date` (timestamp) to the schema.
    *   [x] **UI Implementation (Auto-Order Submodule):**
        *   **Deep Dive:** In the "Automatic Order" view (`frontend/src/components/worker/Purchases/AutomaticOrder`), replace the simple toggle with a **"Schedule Configuration"** panel.
        *   **Action:** Add a Form with:
            *   "Repeat Every": [Dropdown: Week, Month]
            *   "On": [Dropdown: Monday-Sunday OR Date 1-31]
            *   "Products": [Multi-select list]
    *   [x] **Backend Logic (The Scheduler):**
        *   **Deep Dive:** Since this is an offline-first app, we cannot rely on a cloud Cron job. The check must happen on **App Startup** (`local-bridge`).
        *   **Action:** Create a `SchedulerService.ts` in the backend. On `app.init`, run a query: `SELECT * FROM scheduled_orders WHERE next_run_date <= NOW()`.
        *   **Execution:** For each match, generate a new `purchase_order` and update the `next_run_date` to the future interval. Log this event in `audit_logs` as "System Auto-Order".

### 15. Master-Worker Data Interconnectivity (Unified Dashboard)
*   **Context:** The Master dashboard is currently isolated. It must mirror the Worker's submodules (Files, Clients, Suppliers) so the Master sees exactly what the Worker sees/registers.
*   **Tasks:**
    *   [x] **Port "Files" Module to Master:**
        *   **Deep Dive:** The "Files" module (containing Clients, Suppliers, Client Service) exists in `frontend/src/pages/worker/Files`. It is missing from `frontend/src/pages/master/`.
        *   **Action:** Import and mount the `Files` layout into the Master's router (`frontend/src/pages/master/router.tsx`).
    *   [x] **Global Data Visibility (Interconnection):**
        *   **Deep Dive:** Currently, RLS (Row Level Security) might be restricting Master views to specific contexts.
        *   **Action:** Update the SQL queries for Clients and Suppliers in the Master view to **remove store filters** by default (or provide a "All Stores" dropdown).
        *   **Result:** When a Worker registers a new Supplier in Store A, the Master must see that Supplier immediately in the Master Dashboard > Suppliers tab.
    *   [x] **UI Consistency:**
        *   **Action:** Reuse the exact same Table Components (`ClientTable`, `SupplierTable`) used in the Worker view to ensure the Master sees the same columns, status, and details. Do not duplicate code; refactor these into `frontend/src/components/shared/` if they aren't already.

---

## 🟠 Phase 5: Critical Bug Fixes & UX Gaps (P0) - Immediate Action

### 16. POS & Sales Submodule Deletion Logic
*   **Context:** Users cannot delete items from the cart in Retail, Wholesale, or Proforma modes. The "Delete" button is missing or broken.
*   **Tasks:**
    *   [x] **Fix POS Grid Deletion:**
        *   **Deep Dive:** In `frontend/src/components/worker/Sales/SalesEntryForm.tsx` (or `SanifereGrid.tsx`), the "Delete" action might be disconnected from the state.
        *   **Action:** Ensure the `trash` icon in the grid row calls `removeFromCart(productId)`.
        *   **Shortcut:** Map the **"Delete"** key on the keyboard to trigger the removal of the *selected* row.
    *   [x] **Key Programming Integration:**
        *   **Action:** In `frontend/src/components/worker/Modules/SettingsModule.tsx` (Key Programming), add a "Delete Item" option to the list of assignable functions so users can map F5 or F8 to delete.
    *   [x] **Consistent Behavior:** Ensure this deletion logic works identically across **Retail** (`vente-detail`), **Wholesale** (`facturation-gros`), and **Proforma** (`proforma`) modes.

### 17. Database Corruption & "Vody" Error Fix
*   **Context:** Modifying the product "Vody" triggers a "database disk image is malformed" error. This indicates physical SQLite corruption.
*   **Tasks:**
    *   [x] **Emergency Repair Tool:**
        *   **Action:** Create a "Repair Database" button in the Master Settings -> System Logs page.
        *   **Backend Logic:** Execute `PRAGMA integrity_check;` and `VACUUM;` commands via `better-sqlite3`.
    *   [x] **Input Validation (Root Cause?):**
        *   **Deep Dive:** The "Vody" error might be triggered by invalid characters (emojis, null bytes) in the product name or description.
        *   **Action:** Add strict sanitization to `updateProduct` in `db.ts` to strip non-printable characters before SQL insertion.

### 18. Packaging (Conditionnement) Logic Overhaul
*   **Context:** Selling a "Box" doesn't multiply the price/deduct stock correctly. The logic is superficial.
*   **Tasks:**
    *   [x] **Stock Logic (Base Units):**
        *   **Deep Dive:** Inventory should always be stored in *Base Units* (e.g., Pieces). A "Box of 12" is just a UI abstraction.
        *   **Action:** In `createOrder` and `recordSale`, ensure that if `unit_type === 'Carton'`, the backend receives `quantity * pack_size` as the quantity to deduct.
    *   [x] **Price Calculation Fix:**
        *   **Action:** In `SalesEntryForm.tsx` and `ReplenishmentNeeds.tsx`, when a user switches Unit Type to "Carton":
            *   Update the displayed **Unit Price** to `Base Price * Pack Size`.
            *   OR, if a specific `wholesale_price_ht` (Box Price) is set, use that instead.
    *   [x] **UI Responsiveness:**
        *   **Action:** Ensure changing the "Unit" dropdown immediately recalculates the Row Total in the grid.

### 19. Generate Orders Enhancements
*   **Context:** Translation error (`menu.purchases.selectSupplierAndConfirm`) and missing product details (Packaging/Unit) in the review dialog.
*   **Tasks:**
    *   [x] **Fix Translation Key:**
        *   **Action:** Verify `frontend/src/components/master/Purchases/ReplenishmentNeeds.tsx` uses `t('menu.purchases.selectSupplierAndConfirm')` correctly (already fixed in previous session, but verify recurrence).
    *   [x] **Add Columns to Order Dialog:**
        *   **Action:** In the `Dialog` inside `ReplenishmentNeeds.tsx`, add columns for **"Packaging"** (Cndt) and **"Unit"**.
        *   **Logic:** Allow the Master to toggle between ordering in "Pieces" or "Cartons" directly in this dialog, updating the total cost accordingly.

### 20. Missing Translations & Bambara Audit
*   **Context:** The "Add Item" widget in Inventory (Master) and Products (Files) is untranslated. Bambara support is incomplete in Worker submodules.
*   **Tasks:**
    *   [x] **Translate Add Item Dialog:**
        *   **Action:** In `InventoryPage.tsx` and `FichiersProduitsModule.tsx`, wrap all labels (`Nom`, `Prix`, `Stock`, `Image`) in `t(...)` calls. Add missing keys to `fr`, `en`, `bm`.
    *   [x] **Bambara Deep Audit:**
        *   **Action:** SYSTEMATICALLY review every Worker submodule (`Sales`, `Stock`, `Files`, `Edition`). Identify any hardcoded French strings and move them to `bm/translation.json`.
        *   **Specific Focus:** Check the "Tables" (Headers), "Buttons" (Save, Cancel), and "Toasts" (Success/Error messages).

---

## 🔵 Phase 6: Logic Refinement & Deep Polish (P0) - User Feedback

### 21. Key Programming Display Fix
*   **Context:** The "Delete" button (and potentially others) works when pressed but shows as "none" or blank in the `SanifereFooter` visual keypad.
*   **Tasks:**
    *   [x] **Fix Visual Mapping:**
        *   **Deep Dive:** In `frontend/src/components/worker/Sales/SanifereFooter.tsx`, the `ACTION_LABELS` map likely uses the key `'delete'` but the settings store might be saving it as `'ACTION_DELETE'` or similar, causing a mismatch.
        *   **Action:** Verify the exact string used in `SettingsModule` (`'delete'`) matches the key in `SanifereFooter`. Ensure `t('common.delete')` is correctly pulled.

### 22. Generate Orders: Translation & Packaging Logic
*   **Context:** Translations for `selectSupplier` are raw keys. Packaging logic in orders needs to be consistent with product definitions.
*   **Tasks:**
    *   [x] **Fix Raw Translation Keys:**
        *   **Action:** Verify `ReplenishmentNeeds.tsx` uses `menu.purchases.selectSupplier` and that the JSON files have this exact path nested correctly. The user reported it is still showing the raw key.
    *   [x] **Packaging Logic (Order Dialog):**
        *   **Deep Dive:** Packaging (e.g., "12") is defined at the Product level. In the Order Dialog, this should be **read-only** information.
        *   **Action:** Display "Packaging: 12" as text. When the user enters "Quantity: 2", the system should treat this as "2 Boxes" (if Unit=Box) or "2 Pieces" (if Unit=Piece).
        *   **Clarification:** Ensure the "Unit" toggle in the dialog clearly switches between `Piece` (Quantity = 1) and `Box` (Quantity = Pack Size).

### 23. Universal Packaging & Price Logic (The Core Math)
*   **Context:** Prices must scale logically. A "Box of 12" must sell for `Unit Price * 12` (or distinct Wholesale Price). Stock deduction must be accurate.
*   **Tasks:**
    *   [x] **Sales Module Price scaling:**
        *   **Action:** In `SalesModule.tsx` `handleToggleUnit`, ensure `newPrice` is calculated as `basePrice * conditionnement`.
    *   [x] **Stock Valuation Accuracy:**
        *   **Deep Dive:** `ValorisationStock.tsx` calculates total value.
        *   **Action:** Ensure it uses: `Sum(Quantity * Cost Price)`. Since Quantity is always in Base Units, this *should* be correct, but verify it isn't trying to divide by pack size unnecessarily.
    *   [x] **Inventory/Files Form Polish:**
        *   **Action:** In the "Add Product" form, clarify the inputs: "Retail Price (Piece)" vs "Wholesale Price (Box/Pack)". Ensure the UI makes this relationship clear.

### 24. Translation Audit: Add Item & Products Table
*   **Context:** The "Add Item" dialog is 100% French hardcoded. The Products table has mixed headers like "Pre-detail".
*   **Tasks:**
    *   [x] **Translate Add Item Forms:**
        *   **Action:** Completely refactor `InventoryPage.tsx` (Master) and `FichiersProduitsModule.tsx` (Worker) forms. Wrap every `<Label>Name</Label>` with `t('inventory.fields.name')`.
        *   **Languages:** Add keys to `en`, `fr`, `bm`.
    *   [x] **Fix Product Table Headers:**
        *   **Action:** In `FichiersProduitsModule.tsx`, replace hardcoded strings like "Prix Détail" with `t('inventory.fields.retailPriceShort')`.

### 25. Master Stock Valuation Port
*   **Context:** The Master needs the same "Stock Valuation" visibility as the Worker.
*   **Tasks:**
    *   [x] **Port ValorisationStock:**
        *   **Action:** Import `ValorisationStock` into the Master Dashboard (likely in `InventoryPage` as a new Tab or a separate Analytics sub-view).
        *   **Logic:** Ensure it accepts a `storeId` prop so the Master can view valuation for *specific* stores, not just a global sum.

---

## 🔴 Phase 7: Critical Repairs & Logic Rectification (P0) - User Feedback

### 26. "Vody" & Database Corruption Handling
*   **Context:** The product "Vody" triggers "database disk image is malformed". General updates (like Family change for "Oranjeboom") are failing, likely due to DB locks or payload issues.
*   **Tasks:**
    *   [x] **Force Delete Tool:**
        *   **Action:** Enhance the "System Tools" in `SettingsModule` to allow deleting a product by Name (risky but needed) or ID, bypassing standard checks if possible.
        *   **Note:** If the SQLite file is physically corrupt, only a file deletion/restore or `VACUUM` can fix it.
    *   [x] **Persistence Verification:**
        *   **Deep Dive:** Verify `OfflineInventoryService` actually sends the `category_id` (family) in the update payload. The user says "Family doesn't get updated".

### 27. Stock Valuation Multiplier Logic
*   **Context:** User states: "Oranjeboom... packing is 12... we have 20... value should be 12 * 20 * price".
*   **Interpretation:** The user views the Stock Quantity (20) as **PACKS**, not Pieces.
*   **Conflict:** The system assumes Stock Quantity = Base Units.
*   **Fix:**
    *   [x] **Action:** In `db.ts` `getStockValuation`, add logic: `IF unit_type IN ('Carton', 'Box') THEN value = quantity * packaging * unit_price`.
    *   [x] **Risk:** If the user mixes Pieces and Boxes, this breaks. But if they set the product Unit to "Carton", we must respect their convention that "1 Stock = 1 Carton".

### 28. Robust Delete Button (Keyboard)
*   **Context:** "Delete button is still not working".
*   **Tasks:**
    *   [x] **Global Capture:**
        *   **Action:** Ensure the `Delete` key listener in `SalesModule` captures events on the `window` object, not just the grid `div`.
        *   **Safety:** Ensure it doesn't trigger if the user is typing in the Search/Barcode input.

### 29. Final Translation Polish
*   **Context:** Inventory Tabs and specific Dropdowns are still untranslated.
*   **Tasks:**
    *   [x] **Inventory Tabs:** Verify `t('menu.program.inventory')` implementation in `InventoryPage`.
    *   [x] **Family Dropdown:** Ensure `t('inventory.allFamilies')` is correctly loaded.

---

## 🔵 Phase 8: Backend Architecture — Split db.ts into Repository Modules (P1)

> **PRD Reference:** `memory-bank/docs/PRD_split_db_into_repository_modules.md`  
> **Scope:** Zero-feature, zero-behavioral-change structural refactor.  
> **Target:** `backend/local-bridge/src/db.ts` (2,193 lines → 18 files, none > 350 lines)

### 30. Refactor db.ts — Phase 1: Setup & Foundation
*   **Context:** Create the `src/db/` directory structure and extract non-method code (types, connection, schema, migrations).
*   **Tasks:**
    *   [ ] **30.1 — Create directory structure:**
        *   Create `backend/local-bridge/src/db/` directory.
        *   Create `backend/local-bridge/src/db/repositories/` subdirectory.
    *   [ ] **30.2 — Extract types.ts (~280 lines):**
        *   Move all 19 exported interfaces from `db.ts` to `db/types.ts`:
            *   `LocalUser`, `LocalRole`, `LocalSession`, `LocalStore`, `LocalWorkerInvitation`, `LocalProductFamily`, `LocalProduct`, `LocalSupplier`, `LocalPurchaseOrder`, `LocalPurchaseItem`, `LocalSupplierPayment`, `LocalDelivery`, `LocalSale`, `LocalSaleItem`, `LocalScheduledOrder`, `LocalScheduledOrderItem`, `LocalInventoryMovement`, `LocalPendingMutation`, `LocalReplenishmentRequest`, `LocalAuditLog`, `ReplenishmentNeed`.
        *   Move `sanitizeString` helper to `db/types.ts` (used by multiple repos).
        *   Export everything with named exports.
    *   [ ] **30.3 — Extract connection.ts (~80 lines):**
        *   Move `LocalBridgeDatabase` constructor logic (data dir creation, `pkg` detection, native binding resolution, WAL mode, PRAGMA settings).
        *   Move `dbFile` getter.
        *   Export `dbInstance` and `rawDb` (the bare `better-sqlite3` `Database` object).
    *   [ ] **30.4 — Extract schema.ts (~350 lines):**
        *   Move `initialize()` method body into standalone `initializeSchema(db: Database.Database)` function.
        *   Includes: all 18 `CREATE TABLE IF NOT EXISTS`, FTS5 virtual table, 3 triggers, 18 `CREATE INDEX`, `ensureColumn()` helper, all `ALTER TABLE ADD COLUMN` calls.
    *   [ ] **30.5 — Extract migrations.ts (~40 lines):**
        *   Move `migrate()` method body into standalone `runMigrations(db: Database.Database)` function.
        *   Includes: trigger recreation logic (`sale_items_ai`).
    *   [ ] **30.6 — Checkpoint: `npm run build` must pass with zero errors.**
        *   At this point, `db.ts` still exists but its types/interfaces import from `db/types.ts`.

### 31. Refactor db.ts — Phase 2: Extract Repositories (Leaf modules first)
*   **Context:** Extract each domain's methods into factory-function repository files. Each repo receives the raw `db` instance as a parameter. Order: least cross-domain dependencies first.
*   **Tasks:**
    *   [ ] **31.1 — audit.repo.ts (2 methods):**
        *   `insertAuditLog`, `listAuditLogs`
    *   [ ] **31.2 — sync.repo.ts (3 methods):**
        *   `listPendingMutations`, `insertPendingMutation`, `updatePendingMutationStatus`
    *   [ ] **31.3 — invitations.repo.ts (4 methods):**
        *   `listInvitations`, `getInvitationById`, `getInvitationByToken`, `insertInvitation`
    *   [ ] **31.4 — auth.repo.ts (13 methods):**
        *   `getMasterUser`, `getUserByEmail`, `getUserById`, `getRolesForUser`, `insertUser`, `listUsers`, `listUserRoles`, `insertRole`, `getSessionByRefreshToken`, `createSession`, `updateSessionTokens`, `deleteSession`, `deleteExpiredSessions`
    *   [ ] **31.5 — stores.repo.ts (6 methods):**
        *   `getStoreById`, `getStoreByName`, `listStores`, `listStoresByOwner`, `insertStore`, `deleteStore`
    *   [ ] **31.6 — inventory.repo.ts (2 methods):**
        *   `listInventoryMovements`, `insertInventoryMovement`
    *   [ ] **31.7 — suppliers.repo.ts (4 methods):**
        *   `listSuppliers`, `getSupplierById`, `insertSupplier`, `deleteSupplier`
    *   [ ] **31.8 — scheduling.repo.ts (5 methods):**
        *   `listScheduledOrders`, `insertScheduledOrder`, `deleteScheduledOrder`, `listScheduledOrderItems`, `insertScheduledOrderItem`
    *   [ ] **31.9 — analytics.repo.ts (5 methods):**
        *   `getDailyRevenue`, `getWeeklyRevenue`, `getTopProducts`, `getTopWorkers`, `getStockValuation`
    *   [ ] **31.10 — purchasing.repo.ts (9 methods):**
        *   `listPurchaseOrders`, `getPurchaseOrderById`, `insertPurchaseOrder`, `deletePurchaseOrder`, `listPurchaseItems`, `insertPurchaseItem`, `deletePurchaseItem`, `listSupplierPayments`, `insertSupplierPayment`
    *   [ ] **31.11 — deliveries.repo.ts (4 methods):**
        *   `listDeliveries`, `getDeliveryById`, `insertDelivery`, `deleteDelivery`
    *   [ ] **31.12 — sales.repo.ts (6 methods):**
        *   `listSales`, `getSaleById`, `insertSale`, `deleteSale`, `listSaleItems`, `insertSaleItem`
    *   [ ] **31.13 — replenishment.repo.ts (3 methods):**
        *   `listReplenishmentRequests`, `insertReplenishmentRequest`, `getReplenishmentNeeds`
    *   [ ] **31.14 — products.repo.ts (10 methods — largest):**
        *   `listProducts`, `listAllProducts`, `searchProducts`, `getProductById`, `insertProduct`, `deleteProduct`, `listProductFamilies`, `getProductFamilyById`, `insertProductFamily`, `deleteProductFamily`
    *   [ ] **31.15 — Checkpoint: `npm run build` must pass. Every repo independently importable.**

### 32. Refactor db.ts — Phase 3: Wire Barrel & Rewire Imports
*   **Context:** Create `db/index.ts` barrel that composes all repos into a single `db` object, then update every consumer file.
*   **Dependency audit (17 consumers + 1 type-only import):**
    *   3 files import `{ db } from './db.js'` → change to `'./db/index.js'`
    *   13 route files import `{ db } from '../db.js'` → change to `'../db/index.js'`
    *   1 file imports `type { LocalRole } from '../../db.js'` → change to `'../../db/index.js'`
*   **Critical: exposed surface that must be preserved on the `db` object:**
    *   `db.db` (raw `Database` instance) — used by `scheduler.ts` (1 usage), `emergency.ts` (8 usages), `products.ts` (6 usages), `system.ts` (4 usages) for direct SQL: `REINDEX`, `VACUUM`, `integrity_check`, `DROP TABLE`, raw `prepare()`.
    *   `db.initialize()` — called by `emergency.ts` and `products.ts` after dropping all tables.
    *   `db.dbFile` — used by `index.ts` to expose data path in system info.
*   **Tasks:**
    *   [ ] **32.1 — Create db/index.ts (barrel file):**
        *   Import `rawDb` from `connection.ts`.
        *   Import `initializeSchema` from `schema.ts`.
        *   Import `runMigrations` from `migrations.ts`.
        *   Import all 14 `createXRepo` factory functions.
        *   Re-export all types: `export * from './types.js'`.
        *   Compose `db` object with spread: `{ db: rawDb, get dbFile(), initialize: () => initializeSchema(rawDb), ...createAuthRepo(rawDb), ...createStoresRepo(rawDb), ... }`.
    *   [ ] **32.2 — Rewire root-level imports (3 files):**
        *   `src/index.ts`: `'./db.js'` → `'./db/index.js'`
        *   `src/scheduler.ts`: `'./db.js'` → `'./db/index.js'`
        *   `src/seed.ts`: `'./db.js'` → `'./db/index.js'`
    *   [ ] **32.3 — Rewire route imports (13 files):**
        *   `routes/auth.ts`, `routes/products.ts`, `routes/sales.ts`, `routes/deliveries.ts`, `routes/purchasing.ts`, `routes/analytics.ts`, `routes/audit.ts`, `routes/stores.ts`, `routes/sync.ts`, `routes/team.ts`, `routes/invitations.ts`, `routes/system.ts`, `routes/emergency.ts`: all `'../db.js'` → `'../db/index.js'`
    *   [ ] **32.4 — Rewire nested imports (1 file):**
        *   `routes/utils/auth.ts`: `type { LocalRole } from '../../db.js'` → `'../../db/index.js'`
    *   [ ] **32.5 — Delete old `src/db.ts`.**
    *   [ ] **32.6 — Checkpoint: `npm run build` passes with zero errors.**

### 33. Refactor db.ts — Phase 4: Final Verification
*   **Context:** Full verification that the refactor is behavior-identical.
*   **Tasks:**
    *   [ ] **33.1 — `npm run build`** — zero TypeScript errors.
    *   [ ] **33.2 — `npm run dev`** — server starts, prints `[DB]` connection log.
    *   [ ] **33.3 — Smoke test: Auth** — login/register flow works.
    *   [ ] **33.4 — Smoke test: Products** — list, search (FTS5), create, delete.
    *   [ ] **33.5 — Smoke test: Sales** — create sale, list sale items.
    *   [ ] **33.6 — Smoke test: Deliveries** — create, list.
    *   [ ] **33.7 — Smoke test: Analytics** — revenue, top products.
    *   [ ] **33.8 — Smoke test: System** — integrity check, VACUUM (tests `db.db` access).
    *   [ ] **33.9 — Verify no file in `src/db/` exceeds 350 lines.**
    *   [ ] **33.10 — Git commit:** `refactor: split monolithic db.ts (2,193 lines) into 18 repository modules`

## 🟣 Phase 9: Client Service & Discount Logic (P0)

### 34. Client Service Backend & Frontend
*   **Context:** Implement Clients, Client Groups (Services), and auto-apply discounts.
*   **Tasks:**
    *   [x] **Database Schema:**
        *   [x] Create `clients` table.
        *   [x] Create `client_services` table.
        *   [x] Add `client_id` to `sales` table.
        *   [x] Update `db.ts` legacy schema.
    *   [x] **Backend Repositories:**
        *   [x] Create `clients.repo.ts`.
        *   [x] Create `client_services.repo.ts`.
        *   [x] Register in `db/index.ts`.
    *   [x] **Backend Routes:**
        *   [x] Create `routes/clients.ts` (CRUD + Payments).
        *   [x] Register routes in `index.ts`.
        *   [x] Seed default client groups (VIP, Grossiste, Public).
    *   [x] **Frontend Integration:**
        *   [x] Wire `FichiersClientsModule` to API.
        *   [x] Wire `FichiersServicesClientsModule` to API.
    *   [x] **Sales Logic (Auto-Discount):**
        *   [x] Update `SalesModule.tsx` `handleClientChange` to fetch client group.
        *   [x] Apply `default_discount_percent` to all line items.
        *   [x] Update `addProduct` to use stored session discount.
    *   [x] **Sale Creation Integrity:**
        *   [x] Pass `client_id` and `discount` in sale payload.
        *   [x] Update `routes/sales.ts` to deduct stock (MAX(0, qty-?)).
        *   [x] Update `routes/sales.ts` to update client balance if credit.
    *   [x] **i18n:**
        *   [x] Add translation keys to `en`, `fr`, `bm`.

## 🟣 Phase 10: Offline→Online Hybrid Sync (P0)

### 35. Hybrid Sync MVP Implementation (PRD-014)
*   **Context:** Keep local offline reliability while enabling optional cloud sync for multi-store visibility, backup, and remote continuity.
*   **Tasks:**
    *   [ ] **35.1 — Local Sync Tables:** Add `sync_outbox` and `sync_state` tables to SQLite migrations in local bridge.
    *   [ ] **35.2 — Version Columns:** Add `version`, `updated_at`, `deleted_at` to synced entities (products, clients, client_services, sales, purchase_orders).
    *   [ ] **35.3 — Outbox Emission:** Write outbox events for every create/update/delete mutation with idempotency keys.
    *   [ ] **35.4 — Cloud API Scaffold:** Implement `/api/v1/sync/handshake`, `/api/v1/sync/push`, `/api/v1/sync/pull`.
    *   [ ] **35.5 — Idempotency + Conflicts:** Enforce deterministic conflict rules and duplicate-safe operation replay.
    *   [ ] **35.6 — Background Sync Worker:** Push/pull with retry backoff; must not block POS transaction flow.
    *   [ ] **35.7 — Admin Diagnostics:** Add queue length, last success, last error panel for support/debug.
    *   [ ] **35.8 — Pilot Validation:** Test 48h offline operation then reconnect and reconcile without data loss.