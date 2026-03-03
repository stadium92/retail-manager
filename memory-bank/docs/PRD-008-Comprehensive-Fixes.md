# PRD-008: Comprehensive Fixes & Consolidation (Phase 6+)

## 1. Overview
This PRD outlines the strategy to resolve a complex array of overlapping bugs reported across the application. The issues range from backend synchronization failures and empty datasets to missing translation keys and unit scaling logic gaps. 

To prevent regressions, fixes will be grouped logically into isolated branches based off `main-cloud-build`.

## 2. Problem Categorization & Analysis

### Category A: Synchronization & Data Fetching (High Priority)
1. **Inventory Syncing:** Products saved while online stay online and are not saved in the local database (Master/Worker). Conflicts and duplication handling need a deeper strategy.
   * *Status:* We previously created `PRD-Inventory-Sync-Refactor.md` for this. This requires dedicated focus (passing the context to Claude 4.6).
2. **"Product Stock Sheet" & "Stock Listing" Empty:** These worker submodules cannot access data.
   * *Hypothesis:* The offline services or components are likely fetching with incorrect queries, missing `store_id` context, or the UI isn't mapping the backend response correctly.
3. **"Stock Inventory" Empty & Reloads on Search:** The module shows no data, and searching causes a full page reload.
   * *Hypothesis:* The search `<form>` lacks an `e.preventDefault()`, causing a hard browser reload instead of a React state update.

### Category B: Product Search & Generation (High Priority)
1. **Worker Sales Search Blank:** The F3 search shortcut in the worker sales module doesn't display products.
   * *Status:* This was reportedly fixed in `main-cloud-build`, but if it persists, we need to verify the `useProductSearch` hook and ensure the FTS index is populated on the worker's local database.
2. **Master "Product to Order" Search Blank:** Similar to above, searching for new products to order yields blank results.
3. **Supplier Info Missing in "Product to Order":** Cannot access supplier information when generating new orders due to "backend synchronicity error".
4. **"Choose Article" Global Search:** The button next to the search bar should access the *full* inventory (all stores) and display a "Store" column to differentiate items.

### Category C: Unit Scaling & Logistics (Medium Priority)
1. **"Paquet" and "Sac" Support:** The scaling logic applied to "Carton/Box" needs to be extended to "Paquet" and "Sac" in both the "Product to Order" and "Goods Reception" tabs.
2. **Sales Module Unit Toggle:** In all sales submodules, switching from "Pieces" to "Paquet" or "Bag" must accurately multiply the "Price" column by the unit's packaging amount.
3. **Goods Reception Total Bug:** *User reported this is still an issue despite recent fixes.* Toggling the unit button does not update the total price.

### Category D: UI, UX, & Analytics (Medium/Low Priority)
1. **Sales Export Total Row:** The export data feature needs a row for the cumulative total and the page total.
2. **System Logs Enhancements:** Needs a calendar filter, store dropdown sensitivity, and confirmation prompts for "Repair DB" and "Hard Reset".
3. **Analytics Empty:** "Revenue evolution", "Top 5 products (Volume)", and "Worker performance" show no data.
4. **Translation Errors:** 
   - `menu.management.stockstatus` (Dashboard tab)
   - `COMMON.NAME` (Worker performance table)
   - `menu.management.recordExpense` (Journal tab)

## 3. Branching Strategy

We will tackle these systematically by creating specific branches off `main-cloud-build`.

1. **`fix/stock-modules-data`**: Focuses on Category A (Stock Sheet, Stock Listing, Stock Inventory reload bug).
2. **`fix/search-and-suppliers`**: Focuses on Category B (Sales search, Order search, Supplier access, Global article chooser).
3. **`fix/extended-unit-scaling`**: Focuses on Category C (Adding Paquet/Sac support, fixing Sales unit toggles).
4. **`fix/analytics-and-logs`**: Focuses on Category D (Export totals, System Logs filters, Analytics data, Translations).
5. **`fix/inventory-sync-core`**: Dedicated branch for the deep sync issues (to be handed off to Claude 4.6 via the prepared prompt).

---

## 4. Execution Plan (Immediate Next Steps)

1. I will save this PRD to the memory bank.
2. I will create the `fix/stock-modules-data` branch and begin resolving the empty stock tables and the search reload bug.
3. I will proceed through the branches sequentially.
