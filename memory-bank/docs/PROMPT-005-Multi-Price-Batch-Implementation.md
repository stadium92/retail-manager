# Implementation Prompt — PRD-005: Multi-Price Tiers, Batch Tracking & Supplier Price Integration

> **Target Agent:** Gemini 3 Pro (1M context)  
> **Usage:** Copy-paste this entire file as a prompt. Each phase is self-contained — execute them in order (A → H). You can do multiple phases per session given your 1M context.

---

## 🔑 FILE INDEX — Read These First

Before writing any code, you MUST read and understand these files. They are your source of truth.

| Priority | File | Why |
|----------|------|-----|
| 0 | `memory-bank/docs/CLIENT-BRIEF-005-Multi-Price-Raw.md` | Original unedited client requirements — read for intent and context |
| 1 | `memory-bank/plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md` | The full PRD — database schemas, authorization matrix, frontend specs |
| 2 | `memory-bank/core/context/techContext.md` | Tech stack, build pipeline, architecture overview |
| 3 | `memory-bank/core/context/systemPatterns.md` | Authorization model, safety constraints, AI safety rules |
| 4 | `memory-bank/core/tasks.md` | Master task list — add your new tasks here when done |
| 5 | `memory-bank/core/context/activeContext.md` | Current state and blockers |
| 6 | `backend/local-bridge/src/db.ts` | Legacy monolithic DB (still has schema/migrations) |
| 7 | `backend/local-bridge/src/db/types.ts` | TypeScript interfaces for all entities |
| 8 | `backend/local-bridge/src/db/repositories/products.repo.ts` | Product CRUD + FTS5 search |
| 9 | `backend/local-bridge/src/db/repositories/purchasing.repo.ts` | Purchase orders, items, supplier payments |
| 10 | `backend/local-bridge/src/db/repositories/suppliers.repo.ts` | Supplier CRUD |
| 11 | `backend/local-bridge/src/db/repositories/sales.repo.ts` | Sales + sale items |
| 12 | `backend/local-bridge/src/db/repositories/analytics.repo.ts` | Revenue, valuation queries |
| 13 | `backend/local-bridge/src/routes/products.ts` | Product API endpoints + auth checks |
| 14 | `backend/local-bridge/src/routes/purchasing.ts` | PO receive logic, supplier endpoints |
| 15 | `backend/local-bridge/src/routes/sales.ts` | Sale creation endpoint |
| 16 | `backend/local-bridge/src/routes/stores.ts` | Store management endpoints |
| 17 | `backend/local-bridge/src/routes/analytics.ts` | Valuation endpoint |
| 18 | `backend/local-bridge/src/routes/utils/auth.ts` | JWT auth middleware + role enforcement |
| 19 | `frontend/src/components/worker/Modules/FichiersProduitsModule.tsx` | Worker product form (437 lines) |
| 20 | `frontend/src/components/worker/Modules/StockModule.tsx` | Worker stock module with inline product form |
| 21 | `frontend/src/components/worker/Modules/SalesModule.tsx` | POS — `getProductPrice()` lives here |
| 22 | `frontend/src/components/worker/Sales/SanifereGrid.tsx` | POS grid — editable price/qty/discount |
| 23 | `frontend/src/components/worker/Modules/FichiersFournisseursModule.tsx` | Supplier form |
| 24 | `frontend/src/components/worker/Modules/ReglementsFournisseursModule.tsx` | Supplier payment/balance |
| 25 | `frontend/src/components/worker/Modules/Stock/ValorisationStock.tsx` | Stock valuation display |
| 26 | `frontend/src/pages/master/` | Master-side pages (Inventory, etc.) |
| 27 | `frontend/src/types/index.ts` | Frontend Product interface |
| 28 | `frontend/src/stores/useMasterDataStore.ts` | ProductMaster interface (already has `selling_price_3`, `selling_price_4` stubs) |
| 29 | `frontend/src/services/OfflineInventoryService.ts` | Frontend → Backend data mapping |
| 30 | `frontend/src/locales/en/translation.json` | English translations |
| 31 | `frontend/src/locales/fr/translation.json` | French translations |
| 32 | `frontend/src/locales/bm/translation.json` | Bambara translations |

---

## 🧠 AGENT PERSONA

You are a **10x full-stack developer** who has been the lead architect on this project since day one. You know every line of this codebase. You write surgical, minimal-diff changes. You follow these principles:

1. **Read before you write.** Always read the target file fully before editing. Understand the existing patterns.
2. **Surgical edits.** Change only what needs to change. Do not refactor unrelated code. Do not rewrite working components.
3. **Test the math.** Every price calculation, margin formula, and valuation query must be verified with a concrete numeric example in your reasoning before you write the code.
4. **Respect the auth pyramid.** Every new endpoint or query MUST filter by `store_id` for workers. Masters can see all stores. Deliverers get nothing. Check `routes/utils/auth.ts` for the pattern.
5. **Migration safety.** Use `ensureColumn()` for ALTER TABLE. All new columns MUST be nullable or have defaults. Never DROP or rename existing columns.
6. **i18n completeness.** Every new UI string must have keys in `en`, `fr`, and `bm` translation files.
7. **Shared components.** The product form is used by BOTH Master and Worker. If it's currently duplicated, extract it to `components/shared/`. If it's already shared, modify it once.
8. **Build verification.** After each phase, confirm: `cd backend/local-bridge && npm run build` passes, AND `cd frontend && npm run build` passes.

---

## 🗣️ Q/A TEAM SESSION — The Client's Voice

Below is the raw client discussion that produced this PRD. Read it to understand the **intent** behind each feature. When in doubt about a design decision, refer back to this section.

---

### CLIENT: Multi-Price Tiers

> "I need more price logics, different from the 'Prix de vente' which is the base price. I want more price logics like the 2nd price, 3rd and 4th, which may help since you may have stores in different locations thus different prices. From the selling dashboard (worker side), when selling an item, I should be able to set the price to match another price batch if I want."

> "Specially for the 2nd and other selling prices, I should be able to assign them to a store per default in the 'file' module when creating new product files — there should be an option where I can set the default price (kind of a dropdown of each prices). This feature should be under the 'PRICE' section of the 'add new article' widget."

> "Remember we have this feature in both the master and the worker side of the project — this module was supposed to be written just once so that they are both used by the worker and the master side."

### Q/A TEAM: Purchase Cost Source Analysis

> **Q (Tester):** "At which price are we buying the product?"
> 
> **A (Client):** "The source of the product may vary. Are we buying at wholesale price (Prix en gros)? Or from another store who's got it at another price — the 'prix de revente' (resell price), meant so you won't make any loss on your whole purchases? Or at a different discount price entirely?"
> 
> **Q (Tester):** "How do we track this?"
> 
> **A (Client):** "We should keep track of the product batch values — some batches may not be from a wholesale source or you've got it at a different price. We should differentiate the product batches per price. We should keep track of the difference in margin of each batch — at which price we bought it, and then the price we are selling it."

### CLIENT: Batch Visibility

> "In the inventory, we should be able to see the price differences in the batches, classed by batches and groups we have been buying from. There should be a dropdown for each product file which reveals its batch — the batch being the price, the other information, and the receiving date of the product so we know when we bought it."

> "I suggest using the inventory module side of the master dashboard, also under the submodules of the 'Stock' module under the worker dashboard."

### CLIENT: Supplier Enhancements

> "We should add a price feature to set when buying from the supplier, on the 'add supplier' widget — because we can just set its number and names, not the price."

> "There should be a balance confirmation button for the supplier module — a button that confirms that we have paid the supplier. Because in here we just have the 'Due Balance' and we keep owing him but there is no button to pay him."

### CLIENT: Critical Constraints

> "Please we should take account of the MVP metrics calculations — the calculation logics should smoothly add up and effectively reflect in the valuations features."

> "PLEASE you should not forget about the pyramidal authorization scheme of the backend — a worker assigned in one store cannot access the information in other stores."

### CLIENT: Packaging Quantity Bug (Critical — Phase 0)

> "When adding a new product, and I choose 15 as packaging, and choose just one with 15 as packaging, it is just counted as one product. The quantity is just one, which is bad. The quantity should be 15, not only one."
>
> "Even if it takes the quantity as one packaging (one box = 15 items), the valuation should be the value of those 15 items, not just one."
>
> "When I try to generate new orders, the box is 1,200 instead of per piece 1,300. When I switch box to piece, the price drops to 73, which is bad."
>
> "When I choose box I need the quantity to be the content of the box. When I just pick piece the quantity is the same because we are choosing the piece."

---

## 📋 IMPLEMENTATION PHASES

Execute these in order. Each phase is atomic — commit after each.

**⚠️ PHASE 0 IS A PREREQUISITE. All other phases depend on quantity being stored correctly in base units.**

---

### PHASE 0 (PREREQUISITE): Fix Packaging Quantity & Valuation Logic

**THE RULE: `products.quantity` ALWAYS stores BASE UNITS (pieces). A "box" is a UI abstraction, never a storage unit.**

**The bug:** When a user adds "1 box" with `packaging = 15`, the system stores `quantity = 1` instead of `quantity = 15`. This breaks valuations, margins, order generation, and stock counts.

**Files to fix + what to change:**

1. **Product creation forms** (`FichiersProduitsModule.tsx`, `StockModule.tsx`, and any Master-side form):
   - When user selects `unit_type = 'Carton'/'Box'` and enters `quantity = N`: save to DB as `quantity = N × packaging`
   - When user selects `unit_type = 'Pièce'`: save `quantity` as-is

2. **`SalesModule.tsx`** → `getProductPrice()` and `handleToggleUnit()`:
   - Piece mode: price = `unit_price` (base price per piece)
   - Box mode: price = `unit_price × packaging` (total for the box)
   - Switching box→piece: `newPrice = basePrice` (the original per-piece price)
   - Switching piece→box: `newPrice = basePrice × packaging`

3. **`ReplenishmentNeeds.tsx`** (Order generation):
   - When displaying in "Box" mode: show `unit_price × packaging` as the box price
   - When displaying in "Piece" mode: show `unit_price` as-is

4. **PO Receive** (`routes/purchasing.ts`):
   - When receiving items where `unit_type = 'Carton'`: store `actual_qty = received_qty × packaging`

5. **Valuation** (`ValorisationStock.tsx` / `analytics.repo.ts`):
   - No formula change needed IF quantity is correctly stored in base units
   - Verify: `SUM(quantity × cost_price)` and `SUM(quantity × unit_price)` remain correct

**Numeric verification to run in your head:**
```
Product: Fanta, unit_price=100F, cost_price=73F, packaging=12

Add 1 box → DB qty=12, valuation_cost=12×73=876F, valuation_retail=12×100=1200F ✅
Sell 1 box → POS charges 1200F, deducts 12 from qty ✅
Sell 1 piece → POS charges 100F, deducts 1 from qty ✅
Switch box→piece → price goes 1200→100 ✅
Switch piece→box → price goes 100→1200 ✅
```

**Commit message:** `fix(packaging): enforce base-unit storage and correct box/piece price math (PRD-005 Phase 0)`

---

### PHASE A: Multi-Price Tier Columns + Product Form UI + POS Integration

**Scope:** Add `selling_price_2/3/4` to the database, backend types, API, and frontend product forms. Update POS price selection.

**Backend tasks:**
1. In `db.ts` schema `initialize()`, add `ensureColumn` calls:
   ```
   ensureColumn('products', 'selling_price_2', 'REAL');
   ensureColumn('products', 'selling_price_3', 'REAL');
   ensureColumn('products', 'selling_price_4', 'REAL');
   ```
2. In `db/types.ts`, add to `LocalProduct`:
   ```
   selling_price_2?: number | null;
   selling_price_3?: number | null;
   selling_price_4?: number | null;
   ```
3. In `products.repo.ts`, update `insertProduct` and `updateProduct` to handle the 3 new columns.
4. In `routes/products.ts`, ensure POST and PATCH accept and persist `selling_price_2/3/4`.

**Frontend tasks:**
5. In `frontend/src/types/index.ts`, add `selling_price_2/3/4` to the `Product` interface.
6. In `FichiersProduitsModule.tsx` (or the shared product form), add 3 new price inputs under the "Prix et Marges" section.
7. In `SalesModule.tsx`, update `getProductPrice()` to accept a `priceTier` parameter and select the appropriate price.
8. Add translation keys for `price2`, `price3`, `price4` in all 3 locale files.

**Commit message:** `feat(prices): add selling_price_2/3/4 multi-tier pricing (PRD-005 Phase A)`

---

### PHASE B: Store Default Price Tier

**Scope:** Add `default_price_tier` to stores table. UI to set it. POS auto-selects it.

**Backend tasks:**
1. `ensureColumn('stores', 'default_price_tier', 'INTEGER NOT NULL DEFAULT 1')` in schema.
2. Update `LocalStore` type if it exists, or add it to types.
3. Ensure `routes/stores.ts` PATCH accepts `default_price_tier` (Master only).

**Frontend tasks:**
4. Master → Store Settings: add "Default Price Tier" dropdown (1–4) on each store card.
5. `SalesModule.tsx`: on mount, fetch the worker's assigned store and read `default_price_tier`. Pass it to `getProductPrice()`.
6. Translation keys for the new dropdown.

**Commit message:** `feat(stores): add default_price_tier per store (PRD-005 Phase B)`

---

### PHASE C: Product Batches Table + PO Receive Pipeline

**Scope:** Create `product_batches` table. When a PO is received, create batch records. Handle manual stock additions.

**Backend tasks:**
1. Add `CREATE TABLE product_batches` to schema.
2. Create `batches.repo.ts` with: `listBatches(storeId, productId?)`, `insertBatch()`, `updateBatchRemaining()`, `deleteBatch()`.
3. In `routes/purchasing.ts` → `POST /purchase_orders/:id/receive`: after updating product quantity, ALSO create a `product_batches` row per item.
4. Recalculate `products.cost_price` as weighted average after batch creation.
5. New endpoint: `GET /rest/v1/product_batches?product_id=X&store_id=Y` (auth: Master=all, Worker=own store).

**Frontend tasks:**
6. Create service method `OfflineDataService.getProductBatches(storeId, productId)`.

**Commit message:** `feat(batches): create product_batches table and PO receive pipeline (PRD-005 Phase C)`

---

### PHASE D: FIFO Batch Consumption on Sales

**Scope:** When a sale is made, decrement `quantity_remaining` from oldest batches first. Link `sale_items` to batches.

**Backend tasks:**
1. `ensureColumn('sale_items', 'batch_id', 'TEXT')`.
2. In `routes/sales.ts` → `POST /rest/v1/sales`: for each sale item, run FIFO deduction across batches.
3. Update `products.quantity` and `products.cost_price` after consumption.

**Auth check:** Sale can only consume batches from `claims.store_id`.

**Commit message:** `feat(sales): FIFO batch consumption on sale creation (PRD-005 Phase D)`

---

### PHASE E: Frontend Batch Accordion

**Scope:** Expandable batch rows in Inventory (Master) and Stock (Worker) modules.

**Frontend tasks:**
1. Create `components/shared/ProductBatchAccordion.tsx`.
2. Integrate into Master Inventory table and Worker Stock table.
3. Show: Batch ID, Supplier, Purchase Price, Purchase Type, Qty Remaining, Received Date, Margin %.
4. Translations for all new labels.

**Commit message:** `feat(ui): batch accordion in inventory and stock modules (PRD-005 Phase E)`

---

### PHASE F: Supplier Price Category + Payment Confirmation

**Scope:** Add `default_purchase_type` and `price_notes` to suppliers. Add `confirmed_at` to payments.

**Backend tasks:**
1. `ensureColumn('suppliers', 'default_purchase_type', "TEXT DEFAULT 'wholesale'")`.
2. `ensureColumn('suppliers', 'price_notes', 'TEXT')`.
3. `ensureColumn('supplier_payments', 'confirmed_at', 'TEXT')`.
4. Update supplier types, repos, routes.
5. New endpoint: `PATCH /rest/v1/supplier_payments/:id/confirm` (sets `confirmed_at = NOW()`).

**Frontend tasks:**
6. Add "Price Category" dropdown and "Price Notes" field to the supplier form.
7. Add "Confirm Payment" button on each payment record in `ReglementsFournisseursModule.tsx`.
8. Translations.

**Commit message:** `feat(suppliers): price category and payment confirmation (PRD-005 Phase F)`

---

### PHASE G: Recalculate Valuation & Margin with Batch Data

**Scope:** Update stock valuation to use batch-aware weighted average. Add batch-level margin to reports.

**Backend tasks:**
1. Update `analytics.repo.ts` → `getStockValuation()` to optionally use batch data:
   ```sql
   SELECT SUM(quantity_remaining * purchase_price) as total_cost, ... FROM product_batches WHERE store_id = ?
   ```
2. Add new endpoint: `GET /rest/v1/analytics/batch-margins?store_id=X` returning per-product batch margin breakdown.

**Frontend tasks:**
3. Update `ValorisationStock.tsx` to show batch-aware valuation if available.
4. Translations.

**Commit message:** `feat(analytics): batch-aware stock valuation and margin analysis (PRD-005 Phase G)`

---

### PHASE H: Extract Shared ProductForm Component

**Scope:** Deduplicate the product form between Master and Worker.

**Frontend tasks:**
1. Create `components/shared/ProductForm.tsx` with props: `role: 'master' | 'worker'`, `storeId: string`, `product?: Product`, `onSave()`.
2. Contains all 4 price tier fields, the "default price for store" dropdown, and the full identification/logistics sections.
3. Refactor `FichiersProduitsModule.tsx` to use `<ProductForm />`.
4. Refactor Master Inventory form to use `<ProductForm />`.
5. Verify both render identically.

**Commit message:** `refactor(ui): extract shared ProductForm component for Master and Worker (PRD-005 Phase H)`

---

## ✅ FINAL CHECKLIST

After all phases:
- [ ] `cd backend/local-bridge && npm run build` — zero errors
- [ ] `cd frontend && npm run build` — zero errors
- [ ] Worker in Store A cannot see batches from Store B
- [ ] Master can see all stores' batches
- [ ] Stock valuation reflects weighted average cost
- [ ] POS auto-selects store's default price tier
- [ ] Worker can override price manually (existing behavior preserved)
- [ ] All new UI strings exist in `en`, `fr`, `bm`
- [ ] Update `memory-bank/core/tasks.md` with all completed tasks
- [ ] Update `memory-bank/core/context/activeContext.md` with new state
