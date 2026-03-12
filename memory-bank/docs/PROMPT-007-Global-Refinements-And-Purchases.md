# Phase 7: Global UI Refinements, Purchase Logic Fixes & Master Capabilities

**Context:**
The core local-first engine and synchronization are stable (v0.4.7). We now need to execute a series of UI/UX polishes, correct critical math bugs in the purchasing flow, and expand the Master user's administrative capabilities.

**Execution Strategy:**
For each task below, create a dedicated feature branch branching off `main-cloud-build`. **Do not merge directly to `main-cloud-build`**; instead, push the branch for review.

---

## 🛑 PRIORITY 1: Critical Bugs & Blockers

### Task 1.1: Purchasing Module Scaling & History Bug
- **Problem:** In the Worker Dashboard's Purchase modules (Direct Reception, Manual Order, Auto Order), the Unit/Box toggle logic is inverted. When switching from "Pieces" to "Boxes", the unit cost is being *divided* by the pack size instead of *multiplied*.
- **Problem 2:** Direct purchases in the "Reception" module are not adding stock to the inventory or generating an order history record.
- **Problem 3:** In the Master Dashboard's "Order History" details dropdown, the displayed unit price is inaccurate.
- **Action:** 
  1. Fix the scaling math in `ReceptionAchatsModule.tsx`, `CommandeManuelleModule.tsx`, and `CommandeAutoModule.tsx`. (e.g., `isBox ? basePrice * packSize : basePrice`).
  2. Ensure "Direct Reception" creates a complete `purchase_order` record with status `received` and triggers stock increment events (`inventory_movements` of type `in`), please ensure there is no duplicates in the items when making orders.
  3. Correct the unit price mapping in the Master's purchase history UI to reflect the exact purchase price per piece/box.

---

## ⚡ PRIORITY 2: High-Speed Navigation & UI Polish

### Task 2.1: Barcode Scanner Focus Jump & Quantity Overwrite
- **Problem 1:** When using a barcode scanner while hovering on the "Designation" column, the line fills with the product and the hover box moves to the *next row*. Instead, it should stay on the *same row* and jump to the "Quantity" column so the cashier can immediately set the amount.
- **Problem 2:** The "Quantity" column needs a strict "Clean Overwrite" policy. When hovering over it and typing a number, the existing number must be completely replaced (not appended to).
- **Action:** 
  1. Update the barcode scan handler in `SalesModule.tsx` to set the focus to the quantity column (`col: 5`) of the current row after a successful scan.
  2. Ensure the global keyboard capture logic in `useGlobalKeyboard.ts` and `SalesModule.tsx` enforces a clean overwrite when a number is typed into the Quantity cell.

### Task 2.2: Designation Clean Overwrite
- **Problem:** When navigating via the grid keyboard engine, typing in the Designation column appends to the existing text instead of starting fresh.
- **Action:** Update the capture logic so that typing a character while hovering over the Designation cell *clears* the existing content and starts fresh with the new character. Ensure this does not break the existing quantity/price overwrite behaviors we just solidified.

### Task 2.3: Keyboard Shortcut Swap (Tab -> Shift)
- **Problem:** The user wants to replace the 'Tab' key navigation behavior with the 'Shift' key.
- **Action:** Modify the keyboard navigation engine. 'Shift' should now trigger the "move to next interactive column/row" behavior previously handled by 'Tab'.

### Task 2.4: Translation Key Fix
- **Problem:** The Dashboard sub-module (in GestionModule) displays a raw translation key: `"MENU.PROGRAM.REVENUE"`.
- **Action:** Fix the missing or incorrectly cased translation key in the JSON locale files (en, fr, bm) and ensure the component calls it correctly (e.g., `t('menu.program.revenue')`) and look for more translation keys to fix in the codebase.

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
