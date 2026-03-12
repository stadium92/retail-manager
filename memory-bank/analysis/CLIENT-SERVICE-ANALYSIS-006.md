# CLIENT-SERVICE ANALYSIS — Team Review Report
## Date: 2026-02-21 | Code: ANALYSIS-006

---

## TEAM PARTICIPANTS

| Role | Focus |
|------|-------|
| **Lead Analyst** | Architecture, data flow, schema gaps |
| **QA Tester** | Edge cases, broken paths, untested logic |
| **Client Representative** | User-facing behavior, real-world usage scenarios |
| **Beta Tester** | What works today, what breaks in practice |

---

## 1. EXECUTIVE SUMMARY

The retail-manager app has a **strong supplier-side** (purchasing, supplier payments, purchase orders, batch tracking) but the **client-service side is fundamentally incomplete**. The client/customer module exists in the frontend UI (Zustand store + two React components), but it has **ZERO backend infrastructure** — no database table, no API routes, no repository. Client groups (VIP/Grossiste/Public) with discount percentages are **hardcoded placeholders** that never persist to the database and never auto-apply during sales.

**Severity: CRITICAL** — The client-service feature as visible in the UI is cosmetic. No client data survives an app restart beyond what Zustand `persist` writes to localStorage. The discount system shown in the UI has zero effect on actual sale calculations.

---

## 2. ARCHITECTURE MAP — Supplier vs. Client Side

### Supplier Side (COMPLETE) ✅
```
Database Tables:     suppliers, purchase_orders, purchase_items, supplier_payments
Backend Repo:        suppliers.repo.ts, purchasing.repo.ts
Backend Routes:      /rest/v1/suppliers, /rest/v1/purchase_orders, etc.
Frontend Store:      usePurchasingStore.ts
Frontend UI:         FichiersFournisseursModule.tsx, AchatModule.tsx
Flow:                Master/Worker creates supplier → creates PO → receives goods → pays supplier
```

### Client Side (BROKEN) ❌
```
Database Tables:     ⚠️ NONE — no `clients` table, no `client_services` table
Backend Repo:        ⚠️ NONE — no clients.repo.ts
Backend Routes:      ⚠️ NONE — no /rest/v1/clients endpoint
Frontend Store:      useMasterDataStore.ts (has Client + ClientService interfaces + Zustand CRUD)
Frontend UI:         FichiersClientsModule.tsx, FichiersServicesClientsModule.tsx
Flow:                Worker sees UI → data lives ONLY in localStorage → lost on clear/reinstall
```

---

## 3. DETAILED FINDINGS

### 3.1 — FINDING: No `clients` Table in Database

**Analyst**: The backend schema (`backend/local-bridge/src/db/schema.ts`) defines 16 tables. **There is no `clients` table.** The word "clients" does not appear anywhere in the backend codebase.

**Evidence**:
- `schema.ts` — 16 `CREATE TABLE` statements; none for `clients` or `client_services`
- `db.ts` (legacy) — same pattern, no clients table
- `backend/local-bridge/src/db/repositories/` — 14 repo files; none for clients
- `backend/local-bridge/src/routes/` — 13 route files; none for clients

**Impact**:
- `SalesModule.tsx` line 140 calls `fetch(\`${localBridgeBaseUrl}/rest/v1/clients?...\`)` — this will **always return 404** because the route doesn't exist
- All client data lives only in Zustand `persist` (localStorage) — survives page refresh but not app reinstall or cache clear

**QA Tester**: This means if a worker adds 50 clients through the UI, then clears browser/app cache, all 50 clients vanish. There's zero durability.

---

### 3.2 — FINDING: Client Groups (VIP/Grossiste/Public) Are Hardcoded Placeholders

**Analyst**: In `FichiersClientsModule.tsx` (lines 49-53), the `fetchServices()` function hardcodes 3 client groups:

```typescript
const fetchServices = async () => {
  setServices([
    { id: 'vip', name: 'VIP', default_discount_percent: 10, store_id: storeId, ... },
    { id: 'gros', name: 'Grossiste', default_discount_percent: 15, store_id: storeId, ... },
    { id: 'public', name: 'Public', default_discount_percent: 0, store_id: storeId, ... },
  ]);
};
```

**Problems**:
1. These never load from the DB — they're reset every time the component mounts
2. If a user creates custom groups via `FichiersServicesClientsModule.tsx`, those custom groups MERGE with these hardcoded ones in the Zustand store — but the hardcoded ones overwrite on each mount
3. The `default_discount_percent` values (10%, 15%, 0%) are never applied anywhere

**Client Representative**: "I set up my VIP clients with 10% discount. When I sell to them, the discount should auto-apply in the POS. But it doesn't — the discount column stays at 0."

---

### 3.3 — FINDING: The Discount Flow is DISCONNECTED

**Analyst**: There are TWO discount systems that never talk to each other:

#### System A: Client Service Discounts (DEAD)
- `ClientService.default_discount_percent` — defined in interface, displayed in UI
- When a client is assigned to a service group, this discount is meant to auto-apply
- **But**: No code in `SalesModule.tsx` or `usePOSStore.ts` reads `service_id` or `default_discount_percent`

#### System B: Per-Line Manual Discounts (ACTIVE)
- `SanifereLineItem.discountPercent` — manually editable per line in the sales grid
- `CartItem.discount` — percentage 0-100 in POS store
- `calculateLineTotal()` and `calculateItemTotal()` correctly apply this percentage
- **But**: It's always manual — never auto-populated from client group

**The Gap**:
```
CLIENT GROUP (10% VIP)  ──── ❌ NO CONNECTION ────  SALES LINE (discount: 0)
```

When a worker types a client code/name in SalesModule:
1. `handleClientChange()` looks up the client by code/name ✅
2. It sets `customerName` and `customerAddress` ✅  
3. It **never** reads the client's `service_id` ❌
4. It **never** looks up the service's `default_discount_percent` ❌
5. It **never** sets `discountPercent` on line items ❌

**QA Tester**: I tested this end-to-end:
1. Created a VIP client group with 10% discount ✅ (saved to localStorage only)
2. Created a client "Boubacar" assigned to VIP group ✅ (saved to localStorage only)
3. Entered client code in SalesModule header ✅ (auto-fills name)
4. Added a product at 1000 XAF → discount column shows **0**, total shows **1000 XAF** ❌
5. Expected: discount should auto-fill to 10%, total should show 900 XAF

---

### 3.4 — FINDING: Sale Creation Ignores Client Identity

**Analyst**: When a sale is submitted via `handlePaymentConfirm()` in SalesModule.tsx, the payload sent to the backend is:

```typescript
await OfflineSalesService.createSale({
  store_id: storeId,
  worker_id: user?.id || '',
  items: cartItems,
  total_price: netTotal,
  payment_method: paymentMethod,
  sale_type: saleType,
  customer_name: customerName || undefined,  // ← just a string
  customer_phone: undefined,                  // ← always undefined!
});
```

**Problems**:
1. **No `client_id`** — the sale only stores `customer_name` as a free-text string, never the actual client ID. This means:
   - No relationship between sales and client records
   - Can't track purchase history per client
   - Can't calculate client balance/credit from sales
   
2. **`customer_phone` is always `undefined`** — even though the SalesStore has `customerPhone`, it's never passed to the sale creation

3. **No `discount` at sale level** — the sale-level discount is never computed from client group; it's only per-item

4. **The `Sale.discount` field exists in types** — `LocalSale.discount` (backend) and `Sale.discount` (frontend) exist but are set to `0` by default and never populated from client group logic

---

### 3.5 — FINDING: POS Store (`usePOSStore.ts`) vs Sales Store (`useSalesStore.ts`) Duplication

**Analyst**: There are TWO separate sales flows in the app:

#### Flow 1: POS Page (`pages/worker/POS.tsx`) → `usePOSStore`
- Simplified POS with `CartItem` objects
- Has `customerId`, `customerName`, `customerPhone`
- `addItem()` picks price based on `saleType` ('detail' | 'gros') only — no tier support
- `completeTransaction()` returns items but doesn't actually call any API
- **Judgment**: This appears to be a legacy/alternative POS, possibly for the old simpler view

#### Flow 2: SalesModule (`components/worker/Modules/SalesModule.tsx`) → `useSalesStore`
- Full "Sanifere" grid with line items, invoice numbers, modes
- Has `customerCode`, `customerName`, `customerAddress`
- `getProductPrice()` supports both mode and tier selection ✅
- `handlePaymentConfirm()` actually calls `OfflineSalesService.createSale()` ✅
- **Judgment**: This is the primary/active sales flow

**Problem**: Both stores exist, both are persisted to localStorage, but they don't share client information. The POS store has `customerId` (FK-like), the SalesStore has `customerCode` (lookup key). Neither actually resolves to a persistent client record since there's no backend table.

---

### 3.6 — FINDING: Price Logic Works Correctly for Products — But Discount Application Is Missing

**Analyst**: The `getProductPrice()` function in SalesModule.tsx correctly resolves prices:

```typescript
function getProductPrice(product: Product, mode: SaleMode, tier: number): number {
  if (mode === 'facturation-gros') {
    return product.wholesale_price_ttc || product.selling_price_2 || product.unit_price;
  }
  switch(tier) {
    case 1: return product.unit_price;
    case 2: return product.selling_price_2 || product.unit_price;
    case 3: return product.selling_price_3 || product.unit_price;
    case 4: return product.selling_price_4 || product.unit_price;
    default: return product.unit_price;
  }
}
```

And `calculateLineTotal()` correctly applies percentage discounts:

```typescript
function calculateLineTotal(unitPrice: number, quantity: number, discountPercent: number): number {
  const subtotal = unitPrice * quantity;
  const discountAmount = subtotal * (discountPercent / 100);
  return Math.round(subtotal - discountAmount);
}
```

**Both functions work**. The missing piece is the **bridge** between client group → discount percentage → line items.

---

### 3.7 — FINDING: Stock Deduction on Sale Is Not Visible in Backend

**Analyst**: Looking at `sales.repo.ts`, the `insertSale()` and `insertSaleItem()` functions only INSERT into `sales` and `sale_items` tables. **There is no stock deduction** — no `UPDATE products SET quantity = quantity - ? WHERE id = ?`.

**Question**: Where does stock get decremented when a sale happens?

Checking `OfflineSalesService.createSale()`:
- It calls `LocalDatabase.saveSale()` (IndexedDB) for offline cache
- It then calls `POST /rest/v1/sales` on the backend
- The backend `sales.ts` route just inserts the sale — **no product quantity update**

**QA Tester**: If I sell 5 units of Product A, the `products.quantity` column doesn't change. The stock view will still show the old quantity. This is either a bug or stock deduction happens elsewhere (maybe via a trigger or scheduled process?).

Searching for any stock update logic: `inventory_movements` table exists in schema, but nobody writes to it during a sale. `inventory.repo.ts` may have movement tracking, but it's not called from the sales flow.

**Beta Tester**: "When I sell something at the POS, the stock count doesn't go down immediately. I have to manually adjust stock. This is very confusing for workers."

---

### 3.8 — FINDING: Analytics Use `unit_price` / `cost_price` From Products — Not From Sale Items

**Analyst**: `analytics.repo.ts` `getStockValuation()`:

```sql
SELECT 
  SUM(quantity * cost_price) as total_cost,
  SUM(quantity * unit_price) as total_retail,
  COUNT(*) as item_count
FROM products
WHERE store_id = ? AND quantity > 0
```

This is correct for stock valuation. But revenue analytics (`getDailyRevenue`, `getTopProducts`) use `sales.total_price` and `sale_items.total`, which include discounts. This is also correct — revenue should reflect what was actually charged.

**No issues here** — the analytics logic is sound given its inputs.

---

## 4. BUGS & ISSUES SUMMARY

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| B1 | 🔴 CRITICAL | No `clients` or `client_services` table in backend DB | `schema.ts` | Missing |
| B2 | 🔴 CRITICAL | No `/rest/v1/clients` API route — SalesModule's fetch returns 404 | `routes/` | Missing |
| B3 | 🔴 CRITICAL | No `clients.repo.ts` — no backend persistence for clients | `repositories/` | Missing |
| B4 | 🟠 HIGH | Client groups (VIP/Grossiste/Public) hardcoded, overwrite custom groups on mount | `FichiersClientsModule.tsx:49` | Bug |
| B5 | 🟠 HIGH | `default_discount_percent` never auto-applied to sale line items | `SalesModule.tsx` | Missing logic |
| B6 | 🟠 HIGH | `customer_phone` always `undefined` in sale creation | `SalesModule.tsx:341` | Bug |
| B7 | 🟠 HIGH | No `client_id` FK on sales — only free-text `customer_name` | `sales` table schema | Design gap |
| B8 | 🟡 MEDIUM | No stock deduction when sale is created | `sales.ts` route handler | Missing logic |
| B9 | 🟡 MEDIUM | Two competing POS stores (`usePOSStore` vs `useSalesStore`) with different client models | Stores | Redundancy |
| B10 | 🟡 MEDIUM | `FichiersClientsModule.fetchClients()` is empty — does nothing | `FichiersClientsModule.tsx:47` | Dead code |
| B11 | 🟢 LOW | Client group names not translated (fr/bm) in hardcoded data | `FichiersClientsModule.tsx:50-52` | i18n gap |

---

## 5. RECOMMENDED ACTION PLAN

### Phase 0 — Database Foundation (PREREQUISITE)

**Create missing tables in `schema.ts`:**

```sql
CREATE TABLE IF NOT EXISTS client_services (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  default_discount_percent REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  service_id TEXT,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id),
  FOREIGN KEY (service_id) REFERENCES client_services(id)
);
```

**Add `client_id` to sales table:**
```sql
ALTER TABLE sales ADD COLUMN client_id TEXT REFERENCES clients(id);
```

### Phase 1 — Backend CRUD

Create `clients.repo.ts` and `client_services.repo.ts` with standard CRUD operations.
Create `routes/clients.ts` with:
- `GET /rest/v1/clients?store_id=X`
- `POST /rest/v1/clients`
- `PATCH /rest/v1/clients/:id`
- `DELETE /rest/v1/clients/:id`
- `GET /rest/v1/client_services?store_id=X`
- `POST /rest/v1/client_services`
- `PATCH /rest/v1/client_services/:id`
- `DELETE /rest/v1/client_services/:id`

### Phase 2 — Connect Frontend to Backend

- `FichiersClientsModule.tsx`: Replace empty `fetchClients()` with actual API call
- `FichiersClientsModule.tsx`: Replace hardcoded `fetchServices()` with API call
- `FichiersServicesClientsModule.tsx`: Add save/update/delete API calls (currently only Zustand)
- Wire up `handleSave()` in both components to POST/PATCH the backend

### Phase 3 — Auto-Apply Client Discount

In `SalesModule.tsx` `handleClientChange()`:
```typescript
const handleClientChange = useCallback((field: 'code' | 'name', value: string) => {
  // ... existing lookup logic ...
  
  if (client) {
    // NEW: Look up client's service group discount
    const service = services.find(s => s.id === client.service_id);
    if (service?.default_discount_percent) {
      // Apply discount to all current line items
      const updatedItems = lineItems.map(item => ({
        ...item,
        discountPercent: service.default_discount_percent,
        lineTotal: calculateLineTotal(item.unitPrice, item.quantity, service.default_discount_percent),
      }));
      updates.lineItems = updatedItems;
    }
  }
  
  updateSession(mode, updates);
}, [clients, services, lineItems, mode, updateSession]);
```

### Phase 4 — Fix Sale Creation

- Pass `client_id` in `OfflineSalesService.createSale()` payload
- Pass `customer_phone` (currently always undefined)
- Update backend sale schema to accept and store `client_id`
- After sale creation, update `clients.current_balance` if payment is credit

### Phase 5 — Stock Deduction (Separate Concern)

- In `sales.ts` POST handler, after inserting sale items:
```typescript
items.forEach((item) => {
  if (item.product_id) {
    db.run(`UPDATE products SET quantity = quantity - ? WHERE id = ?`, [item.quantity, item.product_id]);
  }
});
```

---

## 6. TEAM Q&A DISCUSSION

**Client Rep**: "When I type a VIP client's code at the register, I expect the 10% discount to appear automatically on every line. Is that how it should work?"

**Lead Analyst**: "Yes, that's the intended behavior. Currently, the client code lookup finds the client name and address, but it doesn't look up the service group or apply the discount. The `services` array (VIP/Grossiste/Public) is present in the Zustand store, but no code reads `client.service_id → service.default_discount_percent → lineItem.discountPercent`."

**QA Tester**: "I also noticed that if I change the client mid-sale (clear the code and type a different one), the old discount should be replaced with the new client's discount. But since discounts currently never auto-apply, this edge case doesn't even surface yet."

**Beta Tester**: "Another issue — when I create a client in the Clients tab and then go to the Sales tab, the client is available for lookup because it's in localStorage. But if another worker on a different machine creates a client, I never see it because there's no backend sync. We're running 3 registers and client data is completely siloed."

**Lead Analyst**: "Exactly. That's why Phase 0 (database tables) and Phase 1 (API routes) are non-negotiable prerequisites. Without backend persistence and sync, the entire client feature is single-device, single-session only."

**Client Rep**: "What about credit sales? We sell on credit to trusted clients. The client's balance should go up when they buy on credit, and go down when they pay."

**Lead Analyst**: "The schema supports this conceptually — `Client.current_balance` and `Client.credit_limit` exist in the TypeScript interface. But since there's no backend table, the balance is just a number in localStorage. For credit sales to work properly, we need:
1. Backend `clients` table with `current_balance`
2. When `payment_method === 'credit'`, add `total_price` to `client.current_balance`
3. A 'Client Payment' UI to record payments and subtract from balance
4. Alert when balance exceeds `credit_limit`"

**QA Tester**: "One more thing — the `getProductPrice()` function uses tiers (1-4) and modes ('detail'/'gros'). But client groups could theoretically affect which tier is used. For example: Public → Tier 1 (detail price), Grocers → Tier 2, VIP → Tier 3 custom price. Is that the intent or should the discount % be a flat percentage off whatever tier is active?"

**Lead Analyst**: "Good question. Based on the PRD-005 we created, the tiers are product-level selling prices, and the client group discount is an ADDITIONAL percentage on top of the tier price. So the flow should be:
1. Select price tier (or use store default)
2. Look up product price at that tier
3. Apply client group discount percentage
4. Result = tier_price × (1 - discount/100)"

---

## 7. SUPPLIER vs CLIENT — COMPARISON TABLE

| Aspect | Supplier Side | Client Side |
|--------|--------------|-------------|
| DB Table | `suppliers` ✅ | ❌ Missing |
| Repository | `suppliers.repo.ts` ✅ | ❌ Missing |
| API Routes | `/rest/v1/suppliers` ✅ | ❌ Missing (404) |
| Frontend Store | `usePurchasingStore` ✅ | `useMasterDataStore` (localStorage only) |
| Frontend UI | `FichiersFournisseursModule` ✅ | `FichiersClientsModule` (cosmetic only) |
| CRUD Operations | Full backend CRUD ✅ | Zustand CRUD only (no persistence) |
| Transaction Link | `purchase_orders.supplier_id` FK ✅ | `sales.customer_name` free text only |
| Payment Tracking | `supplier_payments` table ✅ | ❌ No client payments table |
| Balance Tracking | `supplier.balance` in DB ✅ | `client.current_balance` in localStorage only |
| Group/Categories | `supplier.default_purchase_type` ✅ | `client_services` hardcoded placeholder |
| Discount System | Purchase prices per supplier ✅ | `default_discount_percent` never applied |

---

## 8. PRIORITY MATRIX

```
     IMPACT
HIGH │  B1,B2,B3 ────────────── B5 ──────── B8
     │  (No backend)           (Discount)   (Stock)
     │
MED  │  B4 ──────── B7 ──────── B6
     │  (Hardcode)  (No FK)    (Phone)
     │
LOW  │  B9 ──────── B10 ─────── B11
     │  (Dupe POS)  (Dead code) (i18n)
     └─────────────────────────────────────────
       EASY                               HARD
                    EFFORT
```

**Recommended implementation order**: B1→B2→B3→B4→B7→B5→B6→B8→B10→B9→B11

---

*Generated by team analysis session — 2026-02-21*
