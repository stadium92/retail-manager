Agent Mission: Complete Logic Porting & Supabase Cleanup"


1. Context: I am currently on the test/local-first-integration branch. This branch has successfully removed all Supabase dependencies. I have another
   branch called minor-issues which contains new reactive features and crucial bug fixes, but it still has old Supabase code.
2. Objective: Port the following logic from minor-issues into the current branch (test/local-first-integration), while ensuring ZERO Supabase code or
   imports remain.


3. Core Features to Port:
    * Sales Module (F4 & Focus): Port the nav-pay-shortcut (F4) logic using useRef for stable closures. Ensure openPayment forces background input
      blur and has a 150ms focus delay for the PaymentDialog. Port the automatic focus return to the grid (first row or last empty row) after a sale
      or cancellation.
    * Sales Module (Order Ref Loading): Port the ultra-robust, fuzzy-matching handleOrderRefLoad logic. It must gracefully handle missing product IDs,
      fallback to local inventory data, and use try-catch blocks to prevent "Mapping Errors". Also, ensure the Invoice No field in SanifereHeader
      triggers this load on "Enter".
    * Sales Module (Empty Rows & Negative Stock): Ensure empty rows (!item.productId) are filtered out before calling createSale or
      handleSaveProforma. Do NOT port any "Insufficient stock" checks; we want to allow negative stock sales.
    * The Event Bus (Reactivity): Implement the localDbDataUpdated event dispatching in all saving functions (Sales, Products, Clients, Suppliers,
      Families, Reception). Apply the corresponding listeners to invalidate caches in the search hooks (useProductSearch, useStockSearch with
      staleTime: 0) and modules like StockListingModule, FicheCaisseModule, and ValorisationStock.
    * Worker Name Mapping: In EditionModule and CashClosingsTab, port the robust worker ID mapping: ((isLoading && !workerMap[sale.worker_id]) ? '...'
      : (sale.worker_id ? (sale.worker_id.length < 15 ? sale.worker_id : \ID: \${sale.worker_id.slice(0,8)}\) : '—')).
    * Global Keyboard: In useGlobalKeyboard.ts, port the strict isolation logic that returns early if document.querySelector('[role="dialog"]')
      exists. Ensure F4 forces a blur before dispatching the custom event.
    * Translations: Port the snake_case keys (`suivi_ventes_jour`, `situation_client, etc.) and totalPage, notClassified to the fr, en, and bm` JSON
      translation files.


4. Constraint: If you find any if (isLocalFirst) blocks during the porting, simplify them. Since this branch is 100% local-first, remove the if
   condition and delete the else (Supabase) branch. Just keep the local logic. Ensure OfflineInventoryService is used instead of raw fetches where
   applicable.