# Retail Manager - Implementation Roadmap v1.0 (Detailed)

This document tracks granular progress toward the v1.0 release. All technical logs and internal data remain in English.

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
    *   [ ] **Verification:** Generate a sale and a purchase, then verify they appear in their respective reports.

### 3. Supplier Settlements Logic
*   **Context:** Payment UI exists but does not currently update supplier balances or record history.
*   **Tasks:**
    *   [x] **State Binding:** Ensure the "Confirm Payment" button triggers the `addPayment` action in `usePurchasingStore`.
    *   [x] **Balance Update:** In `LocalDatabase.ts` (mapped to `db.ts`), implement the atomic transaction: `INSERT payment` AND `UPDATE supplier balance`.
    *   [x] **History View:** Fix the "Payment History" table to pull from the `supplier_payments` table.
    *   [ ] **Verification:** Pay a supplier with a 10,000 F balance and verify it drops to 0 F in the "Files" module.

### 5. Licensing & Activation System
*   **Context:** Business protection and store limits.
*   **Tasks:**
    *   [x] **Nag Screens:** Implement the persistent trial banner and "Activation Required" dialog.
    *   [x] **Store Limit Enforcement:** Add logic to the "Create Store" form to block creation if the limit (2) is reached.
    *   [x] **Service Integration:** Created `LicenseService.ts` and integrated with Tauri/Rust backend.
    *   [ ] **Hard Activation Gate:** Update the logic to require activation input on the very first launch.
    *   [ ] **Brute-Force Protection:** 
        *   Implement a counter for failed attempts.
        *   Limit to 3 attempts per day.
        *   Implement a "Hard Lockout" after 15 total misses, preventing retries until the next calendar day.
    *   [ ] **Banner Suppression:** Ensure the `LicenseBanner` is permanently removed only upon successful valid activation.
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
    *   [ ] **Intro Text:** Add: "Use this screen to record products that are no longer sellable due to expiration, damage, or theft. This ensures your stock levels remain accurate for accounting."
    *   [ ] **Constraint:** Ensure the word "submodule" is NOT used in the text.
    *   [ ] **Verification:** Check visibility in `en`, `fr`, and `bm`.

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
    *   [ ] **Installer Testing:** Verify the .exe runs on a 32-bit Windows environment.
    *   [ ] **Database Path Fix:** Ensure `env.ts` resolves correct Windows path (`C:\Users\...\AppData\Local`) instead of Linux-style `.local/share`.
    *   [ ] **Activation UI Restoration:** Fix missing activation prompt and countdowns (App appears unlocked).
        *   [ ] **Locate Missing Component:** Find or recreate `LicenseBanner` which seems to be missing from the project structure.
        *   [ ] **Integrate Global Check:** Ensure the license check runs on app startup and blocks usage if expired.
    *   [ ] **Cross-Platform Code Commit:** Commit only code changes (no binaries) ensuring compatibility with macOS.

---

## 🟣 Phase 4: Critical Refinement Phase (P0+) - Immediate Action

### 12. Master-Side Family Selection & Worker Context Fix
*   **Context:** The Master dashboard is failing to select product families correctly, and the Master lacks visibility into worker-specific data when viewing a worker's profile.
*   **Tasks:**
    *   [ ] **Fix Family Selector (Master Inventory):**
        *   **Deep Dive:** Investigate `frontend/src/components/master/Inventory`. The `FamilySelector` component likely relies on a `storeId` context that is missing or undefined in the Master view (since Master manages *multiple* stores, unlike a Worker who is bound to one).
        *   **Action:** Ensure the `MasterDashboard` or `InventoryPage` explicitly passes the currently selected Store ID to the `FamilySelector`. If `storeId` is null (Global View), the selector must query `SELECT * FROM families` without a `store_id` filter (or show all).
    *   [ ] **Worker Context Visibility:**
        *   **Deep Dive:** When a Master selects a worker in the "Team" module (`frontend/src/components/master/Team`), the UI currently shows generic info.
        *   **Action:** Implement a `useWorkerDetails` hook that fetches the specific `store_id`, `role`, and `last_active` status from the `profiles` table.
        *   **UI Update:** Display this context in the "Worker Details" sidebar or modal so the Master knows exactly which store context that worker is operating in.

### 13. Purchases Module UX & Generation Logic Overhaul
*   **Context:** The default view is wrong, and the "Generate Orders" button is broken/ambiguous. The Master needs the same manual control as the Worker.
*   **Tasks:**
    *   [ ] **Set Default Tab to "Products to Order":**
        *   **Deep Dive:** Locate `frontend/src/pages/master/Purchases/PurchasesPage.tsx`. The `Tabs` component likely initializes with `defaultValue="history"`.
        *   **Action:** Change the initialization state to `defaultValue="to-order"`. Ensure this persists even after navigating away and back (consider simple `localStorage` persistence).
    *   [ ] **Fix "Generate Orders" Widget (Supplier Selection):**
        *   **Deep Dive:** The current `handleGenerateOrder` function likely fails because it tries to auto-assign suppliers or expects a pre-selection that the UI doesn't provide.
        *   **Action:** Refactor the "Generate" button to open a **"Create Order Dialog"** instead of immediately firing an API call.
        *   **Implementation:** Inside this dialog, add a `<Select>` component for **Suppliers** (fetching from `suppliers` table).
        *   **Logic:** The "Generate" button inside the dialog should remain disabled until a specific Supplier is chosen. This mirrors the `Worker/ManualOrder` flow where supplier selection is the prerequisite step.
    *   [ ] **Parity with Worker Manual Order:**
        *   **Action:** Review `frontend/src/pages/worker/Purchases/ManualOrder.tsx`. Copy the exact logic for "Add Product -> Select Variant -> Add to Cart" and implement it in the Master's "Products to Order" widget. Ensure the Master can manually override quantities before generating the final Purchase Order.

### 14. Automatic Order Scheduling (Cron/Interval System)
*   **Context:** Clients need to schedule orders (e.g., "Every Sunday" or "Every Month on the 1st"). The current system lacks this granularity.
*   **Tasks:**
    *   [ ] **Database Schema Update:**
        *   **Deep Dive:** The `purchase_orders` or a new `scheduled_orders` table needs columns for recurrence.
        *   **Action:** Add `recurrence_type` (daily, weekly, monthly, custom), `recurrence_value` (e.g., 'Sunday', '1'), and `next_run_date` (timestamp) to the schema.
    *   [ ] **UI Implementation (Auto-Order Submodule):**
        *   **Deep Dive:** In the "Automatic Order" view (`frontend/src/components/worker/Purchases/AutomaticOrder`), replace the simple toggle with a **"Schedule Configuration"** panel.
        *   **Action:** Add a Form with:
            *   "Repeat Every": [Dropdown: Week, Month]
            *   "On": [Dropdown: Monday-Sunday OR Date 1-31]
            *   "Products": [Multi-select list]
    *   [ ] **Backend Logic (The Scheduler):**
        *   **Deep Dive:** Since this is an offline-first app, we cannot rely on a cloud Cron job. The check must happen on **App Startup** (`local-bridge`).
        *   **Action:** Create a `SchedulerService.ts` in the backend. On `app.init`, run a query: `SELECT * FROM scheduled_orders WHERE next_run_date <= NOW()`.
        *   **Execution:** For each match, generate a new `purchase_order` and update the `next_run_date` to the future interval. Log this event in `audit_logs` as "System Auto-Order".

### 15. Master-Worker Data Interconnectivity (Unified Dashboard)
*   **Context:** The Master dashboard is currently isolated. It must mirror the Worker's submodules (Files, Clients, Suppliers) so the Master sees exactly what the Worker sees/registers.
*   **Tasks:**
    *   [ ] **Port "Files" Module to Master:**
        *   **Deep Dive:** The "Files" module (containing Clients, Suppliers, Client Service) exists in `frontend/src/pages/worker/Files`. It is missing from `frontend/src/pages/master/`.
        *   **Action:** Import and mount the `Files` layout into the Master's router (`frontend/src/pages/master/router.tsx`).
    *   [ ] **Global Data Visibility (Interconnection):**
        *   **Deep Dive:** Currently, RLS (Row Level Security) might be restricting Master views to specific contexts.
        *   **Action:** Update the SQL queries for Clients and Suppliers in the Master view to **remove store filters** by default (or provide a "All Stores" dropdown).
        *   **Result:** When a Worker registers a new Supplier in Store A, the Master must see that Supplier immediately in the Master Dashboard > Suppliers tab.
    *   [ ] **UI Consistency:**
        *   **Action:** Reuse the exact same Table Components (`ClientTable`, `SupplierTable`) used in the Worker view to ensure the Master sees the same columns, status, and details. Do not duplicate code; refactor these into `frontend/src/components/shared/` if they aren't already.

---

## 🟠 Phase 5: Critical Bug Fixes & UX Gaps (P0) - Immediate Action

### 16. POS & Sales Submodule Deletion Logic
*   **Context:** Users cannot delete items from the cart in Retail, Wholesale, or Proforma modes. The "Delete" button is missing or broken.
*   **Tasks:**
    *   [ ] **Fix POS Grid Deletion:**
        *   **Deep Dive:** In `frontend/src/components/worker/Sales/SalesEntryForm.tsx` (or `SanifereGrid.tsx`), the "Delete" action might be disconnected from the state.
        *   **Action:** Ensure the `trash` icon in the grid row calls `removeFromCart(productId)`.
        *   **Shortcut:** Map the **"Delete"** key on the keyboard to trigger the removal of the *selected* row.
    *   [ ] **Key Programming Integration:**
        *   **Action:** In `frontend/src/components/worker/Modules/SettingsModule.tsx` (Key Programming), add a "Delete Item" option to the list of assignable functions so users can map F5 or F8 to delete.
    *   [ ] **Consistent Behavior:** Ensure this deletion logic works identically across **Retail** (`vente-detail`), **Wholesale** (`facturation-gros`), and **Proforma** (`proforma`) modes.

### 17. Database Corruption & "Vody" Error Fix
*   **Context:** Modifying the product "Vody" triggers a "database disk image is malformed" error. This indicates physical SQLite corruption.
*   **Tasks:**
    *   [ ] **Emergency Repair Tool:**
        *   **Action:** Create a "Repair Database" button in the Master Settings -> System Logs page.
        *   **Backend Logic:** Execute `PRAGMA integrity_check;` and `VACUUM;` commands via `better-sqlite3`.
    *   [ ] **Input Validation (Root Cause?):**
        *   **Deep Dive:** The "Vody" error might be triggered by invalid characters (emojis, null bytes) in the product name or description.
        *   **Action:** Add strict sanitization to `updateProduct` in `db.ts` to strip non-printable characters before SQL insertion.

### 18. Packaging (Conditionnement) Logic Overhaul
*   **Context:** Selling a "Box" doesn't multiply the price/deduct stock correctly. The logic is superficial.
*   **Tasks:**
    *   [ ] **Stock Logic (Base Units):**
        *   **Deep Dive:** Inventory should always be stored in *Base Units* (e.g., Pieces). A "Box of 12" is just a UI abstraction.
        *   **Action:** In `createOrder` and `recordSale`, ensure that if `unit_type === 'Carton'`, the backend receives `quantity * pack_size` as the quantity to deduct.
    *   [ ] **Price Calculation Fix:**
        *   **Action:** In `SalesEntryForm.tsx` and `ReplenishmentNeeds.tsx`, when a user switches Unit Type to "Carton":
            *   Update the displayed **Unit Price** to `Base Price * Pack Size`.
            *   OR, if a specific `wholesale_price_ht` (Box Price) is set, use that instead.
    *   [ ] **UI Responsiveness:**
        *   **Action:** Ensure changing the "Unit" dropdown immediately recalculates the Row Total in the grid.

### 19. Generate Orders Enhancements
*   **Context:** Translation error (`menu.purchases.selectSupplierAndConfirm`) and missing product details (Packaging/Unit) in the review dialog.
*   **Tasks:**
    *   [ ] **Fix Translation Key:**
        *   **Action:** Verify `frontend/src/components/master/Purchases/ReplenishmentNeeds.tsx` uses `t('menu.purchases.selectSupplierAndConfirm')` correctly (already fixed in previous session, but verify recurrence).
    *   [ ] **Add Columns to Order Dialog:**
        *   **Action:** In the `Dialog` inside `ReplenishmentNeeds.tsx`, add columns for **"Packaging"** (Cndt) and **"Unit"**.
        *   **Logic:** Allow the Master to toggle between ordering in "Pieces" or "Cartons" directly in this dialog, updating the total cost accordingly.

### 20. Missing Translations & Bambara Audit
*   **Context:** The "Add Item" widget in Inventory (Master) and Products (Files) is untranslated. Bambara support is incomplete in Worker submodules.
*   **Tasks:**
    *   [ ] **Translate Add Item Dialog:**
        *   **Action:** In `InventoryPage.tsx` and `FichiersProduitsModule.tsx`, wrap all labels (`Nom`, `Prix`, `Stock`, `Image`) in `t(...)` calls. Add missing keys to `fr`, `en`, `bm`.
    *   [ ] **Bambara Deep Audit:**
        *   **Action:** SYSTEMATICALLY review every Worker submodule (`Sales`, `Stock`, `Files`, `Edition`). Identify any hardcoded French strings and move them to `bm/translation.json`.
        *   **Specific Focus:** Check the "Tables" (Headers), "Buttons" (Save, Cancel), and "Toasts" (Success/Error messages).