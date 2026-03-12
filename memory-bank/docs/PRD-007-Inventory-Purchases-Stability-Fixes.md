# PRD-007: Inventory, Purchases, and UI Stability Fixes

## 1. Context & Source Prompt

### 1.1 Original Raw Prompt
> "please here i am trying to say i can't : { Okay, I can add new articles and inventory, like where am I in the inventory module of the master dashboard. I can add new articles, I can modify the already implemented articles. So please, I need you to fix this. }
> Something weird happens with the format of the search button when I'm under the search module of the master dashboard and I'm trying to search for a new product. Sometimes, something weird happens with the format of it, so please need to make sure that it actually behaves correctly and the column doesn't just shrink to just three. Sometimes, when I last long enough in a dashboard, the column just shrinks from almost five to just three and the data just is jagged in some way. I don't know what's happening, so please need to look into that issue.
> Also um when i choose um the unity for example when i choose the unity when trying to modify or adding new article so i need this module to to be added the prices and the value should be scaled up to boxes and this should also works for me for the product for the packaging and for the pack sorry the pack in the units and the bag this will also work for for them so like when i let's get it up to box the price should scale from a piece's price to box price or from a piece's prices to to a pack price or back prices i need this to i just like to i need to be a dow and you should also take account of the packaging slot to the packaging value slots so it's very you should take to this one to an account along quantity initial quantity and all these prices that are actually already present in these slots so whenever i'm trying to add new article or creating article and i want it to be up this way for both the master brain master dashboard and a backend dashboard also same logic to follow in the purchases module so i need same um coherence of logic to follow through the purchase module so whenever i'm trying to generate new new orders generate new orders so the pcs the shovel column the price column total column and it should all like behave coherently like what like how i've been trying to see it and trying to like explain in the master side of the project please so please this um you brainstorm this and think really hard to plan the logics and the code to execute it so thank you so much.
> Also, when trying to generate new orders and I add them in product that's already in pieces and trying to generate the order, there's a unit button. Under the unit column, there is a button where you can just toggle the units. Make sure that when the unit is already set to pieces, I can't change it anymore, so it just stays pieces. You should instead say it shouldn't go to another unit, but you should just say pieces. For example, there's a bug with one of the products that is already in pieces. It's set to the pieces of the product file, and maybe this error is linked to the fact that you're not able to change or modify or add new articles. Please, so maybe the error is used so we can think about that.
> Back to the unit, please. Problem: it is already in pieces. When I click it, it goes to a French version PS. This is very weird. It shouldn't happen this
> and also one miscellaneous thing on the purchase module: the table, the stock table. There is a button when I toggle it; it selects all the items in the table, right, but this button is not working. I can select it, but when I unselect the items of the table, they don't get unselected. Also, when all the rows are not selected and I click on the selected button on the table, the row doesn't get selected. It's like the button is not working just there as a template, so you need to fix that, please.
> and also, there are two toast euros that appear when I'm under the purchase module of the master dashboard, the moment I click on it. Two toast euros just pop up with no indication of the euro, like what's actually happening. This is here, so I guess it was because of the jaggy. We have fixed the search feature, right, where we can kind of look through the items, so we have recently fixed it. You can even check in the commit... About this error, please need you to understand and maybe some catching you. I forgot how to be quality, but it's like catching expectation or something in order to catch us an arrow to see what's actually going on with him.
> Oh yeah and please please um remove the the sub packaging from above the front end and a back end please. The front end code is displaying in any kind of code link to it and you really be munitions with that. Do not kind of remove important code, so all of this should be documented in PRB and you should be really malicious with it because we don't want to break the code already implemented...
> Also, please, there is a stability issue with the product files submodules, which is under the stock module, so please need you also to look into that."

### 1.2 Grammatically Corrected & Improved Prompt
> "I am unable to add new articles or modify existing ones in the Master Dashboard's Inventory module. Please fix this issue.
> Additionally, in the Master Dashboard's search module (when searching for a new product to order), there is a UI formatting bug. The search result columns sometimes randomly shrink from five columns down to three, and the data becomes jagged and misaligned, especially after staying on the dashboard for a while.
> Furthermore, when adding or modifying an article, if I change the unit (e.g., from pieces to boxes/packs/bags), the prices (initial price, wholesale, retail) and the initial quantity should automatically scale up or down based on the packaging value slot. This scaling logic must work in both the Master and Worker dashboards.
> This exact same scaling logic must also apply coherently in the Purchases module when generating new orders (the piece column, price column, and total column should all reflect the packaging multiplier).
> Also, in the Purchases module (Generate Orders), when I add a product that is strictly sold in 'pieces' (pack size = 1), the unit toggle button shouldn't let me change it to boxes. Currently, clicking it changes it to a French translation 'PS' (Pièce) and causes a bug that might be related to why I can't add/modify articles.
> Another issue in the Purchases module's stock table: the 'Select All' checkbox in the table header is broken. Checking it doesn't select all unselected rows, and unchecking it doesn't unselect the selected items. It acts like a non-functional template button.
> Next, whenever I navigate to the Purchases module in the Master Dashboard, two unexplained 'Error' toast notifications immediately pop up. This might be related to our recent fixes to the search feature. Please add error catching/logging to identify and fix what is failing on load.
> Also, please completely and carefully remove all 'sub-packaging' logic from both the frontend and backend (Master and Worker dashboards). Ensure this doesn't break the stable codebase.
> Finally, there is a general stability issue with the 'Product Files' (Fichiers Produits) submodule under the Stock module. Please investigate and fix it.
> Please write a comprehensive PRD documenting all these problems, organize them into implementation phases, and create a new branch for each phase so I can test them one by one."

---

## 2. Problem Definitions & Analysis

### Issue A: Sub-Packaging Removal (Architecture Clean-up)
*   **Problem:** The `sub_packaging` field is cluttering the UI and backend logic without providing current value. It needs to be carefully surgically removed.
*   **Impacted Areas:** `FichiersProduitsModule.tsx`, `OfflineInventoryService.ts`, `LocalDatabase.ts`, `schema.ts`, backend `products.repo.ts`, `types.ts`.

### Issue B: Phantom Errors on Purchases Module Load
*   **Problem:** Two empty/vague "Error" toasts appear immediately when opening the Master Dashboard -> Purchases module.
*   **Root Cause Hypothesis:** Failed initial fetches (e.g., `fetchSuppliers`, `fetchOrders`, or `getReplenishmentNeeds`) missing proper error boundary handling or silent failure logs.
*   **Solution:** Implement robust `try/catch` with explicit console logging (`console.error('[Module] Fetch failed:', err)`) before throwing toasts, to see exactly what API call is bouncing.

### Issue C: Master Inventory Add/Modify Failure & Fichiers Produits Stability
*   **Problem:** The user cannot add or modify articles in the Master Inventory, and the 'Fichiers Produits' submodule has general stability issues.
*   **Root Cause Hypothesis:** Missing `resetForm` calls, undefined references in the payload, or a crash when mapping the `sub_packaging` or unit pricing that invalidates the React state.
*   **Solution:** Trace the `handleSave` and `handleEdit` flows in `FichiersProduitsModule.tsx`. Ensure all state variables are valid.

### Issue D: Universal Unit & Packaging Scaling Logic
*   **Problem:** When toggling between "Piece" and "Box" (or Pack/Bag), the prices and quantities do not visually scale to reflect the package multiplier in the creation/modification forms.
*   **Solution:** 
    *   Implement a central multiplier hook or utility function (`usePackagingScale`).
    *   If a user inputs a Piece price of 1000, and sets Packaging to 12, toggling the unit to "Carton" should dynamically display the price as 12000.
    *   This logic must apply universally in: `FichiersProduitsModule` and `ReplenishmentNeeds`.

### Issue E: Purchase Module Formats & Toggles
*   **Problem 1 (UI Formatting):** The search lookup dialog columns shrink from 5 to 3 and get jagged after extended use.
*   **Problem 2 (Unit Toggle Bug):** If `packaging` is 1 (Piece only), the Unit toggle in "Generate Orders" still clicks, changes to "PS", and bugs out the math.
*   **Problem 3 (Select All Checkbox):** The bulk selection checkbox in the table header of `ReplenishmentNeeds` does not actually select/deselect all rows.

---

## 3. Implementation Phases

To ensure stability, fixes will be implemented in isolated phases. For each phase, a new Git branch will be created, allowing the user to test the specific fixes before moving forward.

### Phase 1: Clean-up & Diagnostics (`branch: fix/phase1-subpackaging-and-errors`)
*   **Objective:** Remove `sub_packaging` safely and implement explicit error catching to stop/identify the double "Error" toasts on the Purchases module.
*   **Tasks:**
    *   Remove `sub_packaging` from `initialFormState` and UI in `FichiersProduitsModule.tsx`.
    *   Remove `sub_packaging` from `OfflineInventoryService.ts` mappers.
    *   Wrap `fetchOrders` and `loadNeeds` in `ReplenishmentNeeds.tsx` and `Purchases.tsx` with detailed console errors to catch the phantom toasts.

### Phase 2: Master Inventory Stability (`branch: fix/phase2-inventory-stability`)
*   **Objective:** Fix the inability to Add/Modify articles and resolve the "Fichiers Produits" crash/stability issues.
*   **Tasks:**
    *   Audit `handleSave` and `handleEdit` in `FichiersProduitsModule.tsx`.
    *   Fix any undefined state accesses or missing reset triggers.

### Phase 3: Search UI Formatting Bug (`branch: fix/phase3-search-ui-format`)
*   **Objective:** Fix the jagged columns and shrinking layout in the `ProductLookupDialog`.
*   **Tasks:**
    *   Refactor the CSS Grid layout in `ProductLookupDialog.tsx` to use strict `min-width` and `flex-1` instead of relative fractional widths that collapse under certain content lengths.

### Phase 4: Dynamic Unit Scaling Logic (`branch: fix/phase4-dynamic-unit-scaling`)
*   **Objective:** Auto-scale prices and quantities when toggling units (Pieces vs. Boxes).
*   **Tasks:**
    *   Implement scaling logic in `FichiersProduitsModule.tsx` so changing the unit dropdown physically updates the price/quantity inputs based on the `packaging` slot.

### Phase 5: Purchase Module Refinements (`branch: fix/phase5-purchases-refinements`)
*   **Objective:** Fix the "Select All" checkbox and prevent invalid unit toggling.
*   **Tasks:**
    *   Fix the `onCheckedChange` logic for the header checkbox in `ReplenishmentNeeds.tsx` to correctly map `selected: true/false` to all `needs`.
    *   Disable the "Unit" toggle button in the Order Dialog if `item.packSize <= 1`.

---

## 4. Execution Protocol
*   The AI agent will check out the `main-cloud-build` branch.
*   It will create the `fix/phase1-subpackaging-and-errors` branch and execute Phase 1.
*   The agent will then pause, push the branch, and await user verification before proceeding to Phase 2.
