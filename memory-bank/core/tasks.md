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

### 4. Keyboard Shortcuts Overhaul (PRD-013)
*   **Context:** Rapid POS interaction via F1-F12 keys.
*   **Tasks:**
    *   [x] **Context Provider:** Implement `ShortcutsContext` to track active shortcuts based on the current module.
    *   [x] **Global Listener:** Add window listener in `App.tsx` or `WorkerLayout.tsx` to catch F-keys globally.
    *   [x] **Help Overlay:** Build the retro DOS-style `ShortcutsHelpOverlay` triggered by **F1**.
    *   [x] **POS Wiring:** Map **F2** to Validate, **F4** to Payment, **F10** to Print.
    *   [x] **Dynamic Labels:** Link `SanifereFooter` button text to user settings.
    *   [x] **Verification:** Complete a full sale cycle using only the keyboard.

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
    *   [x] **Markdown Engine:** Integrate `react-markdown` to render local `.md` files (Requires npm install).

---

## 🟢 Phase 3: UI Polish & Optimization (P2)

### 8. LOSS EXIT UI Polish
*   **Context:** Better user guidance without technical jargon.
*   **Tasks:**
    *   [ ] **Intro Text:** Add: "Use this screen to record products that are no longer sellable due to expiration, damage, or theft. This ensures your stock levels remain accurate for accounting."
    *   [ ] **Constraint:** Ensure the word "submodule" is NOT used in the text.
    *   [ ] **Verification:** Check visibility in `en`, `fr`, and `bm`.

### 9. SQLite FTS5 Performance

*   **Context:** Instant search for low-end hardware.

*   **Tasks:**

    *   [x] **Virtual Table:** Create an FTS5 virtual table for products in the sidecar.

    *   [x] **Query Refactor:** Update search hooks to use `SELECT ... FROM products_fts WHERE name MATCH ...`.

    *   [x] **Verification:** Verified ultra-fast response using FTS5 MATCH syntax.
    
    ### 10. Code Protection & Obfuscation (Security Hardening)
    *   **Context:** Protect intellectual property ("Vibe") and prevent reverse engineering of the licensing logic.
    *   **Tasks:**
        *   [x] **Frontend Obfuscation:** Integrated `vite-plugin-javascript-obfuscator` to scramble the React bundle during production builds.
        *   [x] **Sidecar (Backend) Protection:** Implemented obfuscation for the `local-bridge` (Node.js) build pipeline using `javascript-obfuscator`.
        *   [x] **Security Configuration:** Enabled string encryption, variable mangling, and control-flow flattening to maximize deterrence.
        *   [x] **Verification:** Verified that `npm run build` now triggers obfuscation for both layers.
