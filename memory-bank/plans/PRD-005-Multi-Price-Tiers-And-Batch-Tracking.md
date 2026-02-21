# PRD-005: Multi-Price Tiers, Batch Tracking & Supplier Price Integration

**Status:** Draft — Ready for Implementation  
**Priority:** P0  
**Author:** Q/A Team + Client Session (2026-02-21)  
**Complexity:** Level 4 (Multi-phase, cross-cutting)

---

## Related Files Index

| File | Path | Purpose |
|------|------|---------|
| **This PRD** | `memory-bank/plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md` | Requirements spec |
| **Original Client Brief** | `memory-bank/docs/CLIENT-BRIEF-005-Multi-Price-Raw.md` | Raw unedited client requirements |
| **Implementation Prompt** | `memory-bank/docs/PROMPT-005-Multi-Price-Batch-Implementation.md` | Agent-ready prompt (Gemini 3 Pro) |
| **Tech Context** | `memory-bank/core/context/techContext.md` | Architecture overview |
| **System Patterns** | `memory-bank/core/context/systemPatterns.md` | Auth model & safety rules |
| **Tasks** | `memory-bank/core/tasks.md` | Master checklist |
| **Build Bible** | `memory-bank/tech/cross_architecture_build_bible.md` | Build process |

---

## 1. Problem Statement

The current system has a single retail price (`unit_price`) per product. Store owners operating multiple stores in different locations need **differentiated pricing** — a product may sell for different prices depending on neighborhood, customer type, or resale context. Additionally, the same product may be **purchased from different sources at different costs** (wholesale, resale, discount), and the owner needs batch-level visibility into margins and stock composition.

### Current Limitations
1. Only 1 selling price (`unit_price`) + confusing wholesale fields (`wholesale_price`, `wholesale_price_ht`, `wholesale_price_ttc`)
2. No concept of "purchase batches" — `cost_price` is a flat number, not linked to individual purchases
3. No way to assign a default price tier to a store
4. Supplier form lacks price-category metadata
5. No batch-level margin analysis
6. No "Confirm Payment" acknowledgment flow for supplier settlements

---

## 2. Feature Specification

### 2.1 Multi-Price Tiers (4 Named Selling Prices)

| Tier | DB Column | UI Label (fr) | UI Label (en) | Purpose |
|------|-----------|---------------|---------------|---------|
| **Price 1** | `unit_price` (existing) | Prix de vente | Selling Price | Standard retail — the base price |
| **Price 2** | `selling_price_2` (NEW) | 2ème prix | Price 2 | Neighborhood/discount tier |
| **Price 3** | `selling_price_3` (NEW) | 3ème prix | Price 3 | Bulk/loyal client tier |
| **Price 4** | `selling_price_4` (NEW) | 4ème prix | Price 4 | Inter-store resale (prix de revente) |

**Existing columns:**
- `wholesale_price` → Deprecated (map to `selling_price_2` during migration, keep column for safety)
- `wholesale_price_ht` / `wholesale_price_ttc` → Keep as supplementary HT/TTC info, not separate tiers

### 2.2 Store Default Price Tier

New column on `stores` table:
```sql
ALTER TABLE stores ADD COLUMN default_price_tier INTEGER NOT NULL DEFAULT 1;
```
- Values: 1, 2, 3, or 4
- When Worker opens POS → system pre-selects this tier
- Worker can still override per-line in the sale grid

### 2.3 Purchase Batch Tracking

New table: `product_batches`
```sql
CREATE TABLE IF NOT EXISTS product_batches (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  supplier_id TEXT,
  purchase_order_id TEXT,
  purchase_price REAL NOT NULL,
  purchase_type TEXT NOT NULL DEFAULT 'wholesale',
  quantity_received INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  received_at TEXT NOT NULL,
  expiry_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
);
```

**`purchase_type` enum:** `'wholesale'` | `'resale'` | `'discount'` | `'other'`

**Stock relationship:**
- `products.quantity` = SUM of `product_batches.quantity_remaining` (denormalized cache)
- `products.cost_price` = Weighted average: `SUM(remaining × purchase_price) / SUM(remaining)`
- **FIFO consumption** on sales — oldest batch consumed first

### 2.4 Supplier Price Metadata

New columns on `suppliers`:
```sql
ALTER TABLE suppliers ADD COLUMN default_purchase_type TEXT DEFAULT 'wholesale';
ALTER TABLE suppliers ADD COLUMN price_notes TEXT;
```

### 2.5 Supplier Payment Confirmation

New column on `supplier_payments`:
```sql
ALTER TABLE supplier_payments ADD COLUMN confirmed_at TEXT;
```
- `NULL` = payment recorded, not yet acknowledged
- ISO timestamp = supplier confirmed receipt

### 2.6 Sale & Movement Batch Links

```sql
ALTER TABLE sale_items ADD COLUMN batch_id TEXT REFERENCES product_batches(id);
ALTER TABLE inventory_movements ADD COLUMN batch_id TEXT REFERENCES product_batches(id);
```

---

## 3. Frontend Specification

### 3.1 Product Form — "Prix et Marges" Section

In the **Add/Edit Article** form (shared between Master and Worker):

```
┌─ PRIX ET MARGES ─────────────────────────────────────────────┐
│                                                               │
│  Prix d'achat (P.A.)     [________]                          │
│                                                               │
│  Prix de vente (Price 1)  [________]  ← existing             │
│  2ème prix (Price 2)      [________]  ← NEW                  │
│  3ème prix (Price 3)      [________]  ← NEW                  │
│  4ème prix (Price 4)      [________]  ← NEW                  │
│                                                               │
│  Prix par défaut du magasin: [ ▼ Price 1 ]  ← dropdown      │
│                                                               │
│  Marge: XX%  (auto-calculated from P.A. vs selected price)   │
│                                                               │
│  ── Prix de gros (HT/TTC) ──                                │
│  Wholesale HT  [________]   Wholesale TTC  [________]       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 POS (SalesModule) Price Tier Selection

Updated `getProductPrice()`:
```
function getProductPrice(product, saleMode, storePriceTier):
  if saleMode === 'facturation-gros':
    return product.wholesale_price_ttc || product.selling_price_2 || product.unit_price

  switch(storePriceTier):
    case 1: return product.unit_price
    case 2: return product.selling_price_2 || product.unit_price
    case 3: return product.selling_price_3 || product.unit_price
    case 4: return product.selling_price_4 || product.unit_price
```

Worker can still manually override the price in the grid (existing behavior preserved).

### 3.3 Batch Accordion in Inventory

Each product row gets an expandable section:
```
▼ Fanta 1.5L  |  Total: 120  |  P.V: 500F
  ┌──────────┬────────────────┬────────────────┬───────────────┬──────────────┐
  │ Batch    │ Supplier       │ Purchase Price │ Qty Remaining │ Received     │
  ├──────────┼────────────────┼────────────────┼───────────────┼──────────────┤
  │ B-001    │ Distributor X  │ 200 F          │ 80            │ 2026-01-15   │
  │ B-002    │ Shop Amadou    │ 250 F (resale) │ 30            │ 2026-02-01   │
  └──────────┴────────────────┴────────────────┴───────────────┴──────────────┘
  Weighted Avg Cost: 208F  |  Margin @ Price 1: 292F (140%)
```

**Placement:** Master Inventory, Worker Stock (Inventory/Sheets/Listings)

### 3.4 Supplier Form Enhancement

Add to "Add/Edit Supplier" dialog:
- **"Price Category"** dropdown: Wholesale / Resale / Discount / Other
- **"Price Notes"** text field
- On the supplier list: **"Pay" button** (already exists) + **"Confirm Payment"** toggle on payment records

---

## 4. Authorization Matrix

| Feature | Master | Worker | Deliverer |
|---------|--------|--------|-----------|
| Set Price 1-4 on product | ✅ All stores | ✅ Own store only | ❌ |
| Set store default tier | ✅ | ❌ | ❌ |
| View batches (all stores) | ✅ | ❌ Own store only | ❌ |
| Override price in POS | N/A | ✅ | ❌ |
| Create PO → batch | ✅ Any store | ✅ Own store | ❌ |
| Add supplier + price category | ✅ | ✅ Own store | ❌ |
| Confirm supplier payment | ✅ | ✅ Own store | ❌ |

**Critical:** Worker in Store A CANNOT see batches from Store B. All batch queries filter by `claims.store_id`.

---

## 5. Calculation Impact

| Metric | Current Formula | New Formula | Change? |
|--------|----------------|-------------|---------|
| Stock Valuation | `SUM(qty × cost_price)` | Same — `cost_price` = weighted avg | ✅ Works |
| Sale Margin | `unit_price - cost_price` | Can now show per-batch margin too | Enhanced |
| POS price | `getProductPrice(p, mode)` | `getProductPrice(p, mode, tierNum)` | Updated |
| Purchase Reports | By date/family | Also by supplier + batch price | Enhanced |

---

## 6. PREREQUISITE FIX: Packaging Quantity & Valuation Logic (Phase 0)

**Priority:** P0 — Must be fixed BEFORE any price tier or batch work, because all valuation and quantity math depends on this being correct.

### 6.1 The Bug (Client Report)

> "When adding a new product, and I choose 15 as packaging, and choose just one with 15 as packaging, it is just counted as one product. The quantity is just one, which is bad. The quantity should be 15, not only one."
>
> "Even if it takes the quantity as one packaging (one box = 15 items), the valuation should be the value of those 15 items, not just one."
>
> "When I try to generate new orders, the box is 1,200 instead of per piece 1,300. When I switch box to piece, the price drops to 73, which is bad."

### 6.2 Root Cause Analysis

The system conflates **"1 box"** with **"1 unit"**. There are **two conventions** and they are currently mixed:

| Convention | Meaning of `quantity = 1` | Stock Column | Valuation |
|------------|---------------------------|-------------|-----------|
| **Base Unit** (correct) | 1 piece | Always in pieces | `qty × unit_price` ✅ |
| **Package Unit** (current bug) | 1 box (which contains N pieces) | In boxes | `1 × unit_price` ❌ (should be `N × unit_price`) |

### 6.3 The Fix — "Base Unit Is King" Rule

**RULE:** The database `products.quantity` column ALWAYS stores **base units (pieces)**. A "box" is a UI-level abstraction, never a storage-level unit.

| Action | Expected Behavior |
|--------|-------------------|
| User adds 1 box, packaging = 15 | DB stores `quantity = 15` (1 × 15) |
| User adds 3 boxes, packaging = 15 | DB stores `quantity = 45` (3 × 15) |
| User adds 10 pieces, packaging = 15 | DB stores `quantity = 10` |
| Valuation of 15 pieces at 100F each | `15 × 100 = 1,500F` ✅ |
| POS: sell 1 box (packaging=15) | Deduct 15 from quantity, charge `unit_price × 15` (or `wholesale_price` if set) |
| POS: sell 1 piece | Deduct 1 from quantity, charge `unit_price` |
| Switch box→piece in POS | Price changes from `unit_price × packaging` to `unit_price` |
| Switch piece→box in POS | Price changes from `unit_price` to `unit_price × packaging` |

### 6.4 Files To Fix

| File | What's Wrong | Fix |
|------|-------------|-----|
| **Product creation form** (`FichiersProduitsModule.tsx`, `StockModule.tsx`) | When `unit_type = 'Carton'` and user enters qty=1, it saves `quantity=1` | If user selects box: save `quantity = input_qty × packaging` |
| **SalesModule.tsx** `getProductPrice()` | Box price = `unit_price` (should be `unit_price × packaging`) | `if (isBox) return unit_price × conditionnement` |
| **SalesModule.tsx** `handleToggleUnit()` | Switching box↔piece may not recalculate correctly | Piece→Box: `newPrice = basePrice × packaging`. Box→Piece: `newPrice = basePrice` |
| **ReplenishmentNeeds.tsx** | Order generation shows box price = piece price | When unit=Box, multiply `unit_price × packaging` for display |
| **ValorisationStock.tsx** | Valuation uses `qty × unit_price` but qty might be in boxes | No change needed IF we enforce "qty = base units" rule. But verify. |
| **PO Receive** (`routes/purchasing.ts`) | When receiving boxes, may store box count instead of piece count | If `unit_type = 'Carton'`: `actual_qty = received × packaging` |

### 6.5 Numeric Example (Verification)

```
Product: Fanta 1.5L
  unit_price: 100F (per piece)
  packaging: 12 (1 box = 12 pieces)
  cost_price: 73F (per piece)

Scenario 1: Add 1 box
  → DB quantity = 12
  → Valuation = 12 × 73 = 876F (cost) / 12 × 100 = 1,200F (retail)
  → Margin = 1,200 - 876 = 324F (37%)

Scenario 2: Sell 1 box from POS
  → POS price = 100 × 12 = 1,200F
  → Deduct 12 from quantity
  → Remaining quantity = 0

Scenario 3: Sell 1 piece from POS
  → POS price = 100F
  → Deduct 1 from quantity
  → Remaining quantity = 11

Scenario 4: Generate order for "1 box"
  → Order unit_cost = cost_price × packaging = 73 × 12 = 876F per box
  → OR display as "12 pieces @ 73F = 876F"
```

---

## 7. Implementation Phases

| Phase | Scope | Estimated Complexity |
|-------|-------|---------------------|
| **0 (PREREQ)** | Fix packaging quantity & valuation logic (Section 6 above) | **High — MUST DO FIRST** |
| **A** | `selling_price_2/3/4` columns + frontend form + POS tier | Medium |
| **B** | `stores.default_price_tier` + store settings UI + POS auto | Low |
| **C** | `product_batches` table + batch creation on PO receive | High |
| **D** | FIFO batch consumption on sales + `sale_items.batch_id` | High |
| **E** | Frontend batch accordion in Inventory/Stock | Medium |
| **F** | Supplier price category + payment confirmation | Low |
| **G** | Recalculate valuation/margin with batch data | Medium |
| **H** | Extract shared `<ProductForm />` component | Medium |

---

## 8. Database Migration Summary

| Table | Change |
|-------|--------|
| `products` | ADD `selling_price_2 REAL`, `selling_price_3 REAL`, `selling_price_4 REAL` |
| `stores` | ADD `default_price_tier INTEGER NOT NULL DEFAULT 1` |
| `suppliers` | ADD `default_purchase_type TEXT DEFAULT 'wholesale'`, `price_notes TEXT` |
| `supplier_payments` | ADD `confirmed_at TEXT` |
| `sale_items` | ADD `batch_id TEXT` |
| `inventory_movements` | ADD `batch_id TEXT` |
| NEW `product_batches` | Full table (13 columns) |

All via `ensureColumn()` — zero-downtime, backward compatible.
