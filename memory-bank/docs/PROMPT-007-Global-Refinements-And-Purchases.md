# Phase 7: Global UI Refinements, Purchase Logic Fixes & Master Capabilities

**Context:**
The core local-first engine and synchronization are stable (v0.4.7). We now need to execute a series of UI/UX polishes, correct critical math bugs in the purchasing flow, and expand the Master user's administrative capabilities. The activation gate also requires immediate troubleshooting.

**Execution Strategy:**
For each task below, create a dedicated feature branch branching off `main-cloud-build`. **Do not merge directly to `main-cloud-build`**; instead, push the branch for review.

---

## 🛑 PRIORITY 1: Critical Bugs & Blockers

### Task 1.1: Activation Key Fix
- **Problem:** The activation keys are not working. This is likely an issue with how the frontend communicates with the Tauri Rust backend (which holds the validation logic), or the keys are not being bundled correctly in the release build.
- **Action:** Investigate `frontend/src/services/LicenseService.ts` and the corresponding Rust commands in `src-tauri/src/license.rs`. Ensure the IPC (Inter-Process Communication) bridge is functioning and the payload formats match.

### Task 1.2: Purchasing Module Scaling & History Bug
- **Problem:** In the Worker Dashboard's Purchase modules (Direct Reception, Manual Order, Auto Order), the Unit/Box toggle logic is inverted. When switching from "Pieces" to "Boxes", the unit cost is being *divided* by the pack size instead of *multiplied*.
- **Problem 2:** Direct purchases in the "Reception" module are not adding stock to the inventory or generating an order history record.
- **Problem 3:** In the Master Dashboard's "Order History" details dropdown, the displayed unit price is inaccurate.
- **Action:** 
  1. Fix the scaling math in `ReceptionAchatsModule.tsx`, `CommandeManuelleModule.tsx`, and `CommandeAutoModule.tsx`. (e.g., `isBox ? basePrice * packSize : basePrice`).
  2. Ensure "Direct Reception" creates a complete `purchase_order` record with status `received` and triggers stock increment events (`inventory_movements` of type `in`).
  3. Correct the unit price mapping in the Master's purchase history UI to reflect the exact purchase price per piece/box.

---

## ⚡ PRIORITY 2: High-Speed Navigation & UI Polish

### Task 2.1: Designation Clean Overwrite
- **Problem:** When navigating via the grid keyboard engine, typing in the Designation column appends to the existing text.
- **Action:** Update the global keyboard capture logic (`useGlobalKeyboard.ts` & `SalesModule.tsx`). If the user types a character while hovering over the Designation cell, it should *clear* the existing content and start fresh with the new character. Ensure this does not break existing quantity/price overwrite behaviors.

### Task 2.2: Keyboard Shortcut Swap (Tab -> Shift)
- **Problem:** The user wants to replace the 'Tab' key navigation behavior with the 'Shift' key.
- **Action:** Modify the keyboard navigation engine. 'Shift' should now trigger the "move to next interactive column/row" behavior previously handled by 'Tab'.

### Task 2.3: Global Font Size Increase
- **Problem:** Cashiers requested larger fonts across the entire application.
- **Action:** Increase the base font size of the application by approximately 10%. This can likely be achieved by updating the base `html` or `body` font-size in Tailwind/CSS configuration, or by adjusting the primary typography scale variables.

### Task 2.4: Translation Key Fix
- **Problem:** The Dashboard sub-module (in GestionModule) displays a raw translation key: `"MENU.PROGRAM.REVENUE"`.
- **Action:** Fix the missing or incorrectly cased translation key in the JSON locale files (en, fr, bm) and ensure the component calls it correctly (e.g., `t('menu.program.revenue')`).

---

## 👑 PRIORITY 3: Master Dashboard Capabilities

### Task 3.1: Master Sales Deletion
- **Problem:** The Master user cannot delete recorded sales.
- **Action:** Update the Master Sales dashboard (`Sales.tsx`) to allow deleting sales. Ensure the deletion cascades correctly (reverting stock, removing items, deleting the sale record) using the backend `sales.repo.ts`.

### Task 3.2: Master Family Creation
- **Problem:** The Master needs the ability to create Product Families.
- **Action:** Add the "Product Families" management interface to the Master Dashboard. Place this under the **"Inventory"** section (alongside stock viewing). Reuse or adapt the existing `FichiersFamillesModule.tsx`.

### Task 3.3: Tiered Data Export (Soft vs. Full)
- **Problem:** The Master needs a way to download product/family data, but with a specific filter to exclude sensitive pricing/margin data for sharing purposes.
- **Action:** In the Master's Inventory/Families tab, create a Download button with a dropdown:
  - **"Soft Export":** Includes Identification data (Name, SKU, Barcode) and Logistics data (Packaging, Unit Type). *Excludes* Cost Price, Margins, and Selling Prices.
  - **"Full Export":** Includes all data.

### Task 3.4: Invoice Number Display
- **Problem:** The "Daily Sales" table does not display the Invoice Number.
- **Action:** Add an "Invoice No" column to the Daily Sales table in the Edition module. Ensure it handles empty/null values gracefully (e.g., displaying a fallback token like '---').

### Task 3.5: Component Upgrade (Manual Orders)
- **Problem:** The product search dropdown in "Manual Orders" uses a basic HTML select/dropdown.
- **Action:** Upgrade this to use the advanced, fuzzy-search `ProductLookupDialog` (or similar combobox component) currently utilized in the Sales Module.
