# Implementation Prompt — Client-Service Backend, Discount Auto-Apply & Sale Integrity Fix

> **Target Agent:** Gemini 3 Pro (1M context)  
> **Usage:** Copy-paste this entire file as a prompt. Each phase is self-contained — execute them in order (0 → F). You can do multiple phases per session given your 1M context.  
> **Analysis Source:** `memory-bank/analysis/CLIENT-SERVICE-ANALYSIS-006.md` — full team audit with 11 findings ranked by severity.

---

## 🔑 FILE INDEX — Read These First

Before writing any code, you MUST read and understand these files. They are your source of truth.

| Priority | File | Why |
|----------|------|-----|
| 0 | `memory-bank/analysis/CLIENT-SERVICE-ANALYSIS-006.md` | Full analysis report — 11 bugs, architecture gaps, team Q/A, priority matrix |
| 1 | `memory-bank/plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md` | Related PRD — price tiers interact with client discounts |
| 2 | `memory-bank/core/context/techContext.md` | Tech stack, build pipeline, architecture overview |
| 3 | `memory-bank/core/context/systemPatterns.md` | Authorization model, pyramidal scheme, safety constraints |
| 4 | `memory-bank/core/tasks.md` | Master task list — add your new tasks here when done |
| 5 | `backend/local-bridge/src/db/schema.ts` | **Primary schema** — 16 tables, NO clients table (the core bug) |
| 6 | `backend/local-bridge/src/db.ts` | Legacy monolithic DB (also has schema/migrations, same pattern) |
| 7 | `backend/local-bridge/src/db/types.ts` | TypeScript interfaces for all backend entities |
| 8 | `backend/local-bridge/src/db/repositories/sales.repo.ts` | Sales + sale items — must be modified to link `client_id` |
| 9 | `backend/local-bridge/src/db/repositories/suppliers.repo.ts` | **Reference pattern** — copy this structure for clients.repo.ts |
| 10 | `backend/local-bridge/src/db/repositories/products.repo.ts` | Product CRUD — stock deduction happens here or in sales |
| 11 | `backend/local-bridge/src/db/repositories/analytics.repo.ts` | Revenue + valuation queries |
| 12 | `backend/local-bridge/src/routes/sales.ts` | Sale creation endpoint — must add stock deduction + client_id |
| 13 | `backend/local-bridge/src/routes/purchasing.ts` | **Reference pattern** for route registration and Zod validation |
| 14 | `backend/local-bridge/src/routes/utils/auth.ts` | JWT auth middleware + role enforcement |
| 15 | `backend/local-bridge/src/db/index.ts` | DB object assembly — must register new repos here |
| 16 | `frontend/src/stores/useMasterDataStore.ts` | `Client`, `ClientService` interfaces + Zustand CRUD (already exists, frontend-only) |
| 17 | `frontend/src/stores/usePOSStore.ts` | POS store — `CartItem`, `customerId`, `addItem()`, `setSaleType()` |
| 18 | `frontend/src/stores/useSalesStore.ts` | Sales sessions — `customerCode`, `customerName`, per-mode state |
| 19 | `frontend/src/components/worker/Modules/SalesModule.tsx` | **Primary POS** — `getProductPrice()`, `handleClientChange()`, `handlePaymentConfirm()` |
| 20 | `frontend/src/components/worker/Modules/FichiersClientsModule.tsx` | Client management UI — hardcoded groups, empty `fetchClients()` |
| 21 | `frontend/src/components/worker/Modules/FichiersServicesClientsModule.tsx` | Client groups (services) UI |
| 22 | `frontend/src/components/worker/Sales/SanifereGrid.tsx` | POS editable grid — discount column |
| 23 | `frontend/src/components/worker/Sales/SanifereHeader.tsx` | POS header — customer code/name fields |
| 24 | `frontend/src/services/OfflineSalesService.ts` | Sale creation service — builds POST payload |
| 25 | `frontend/src/services/OfflineAuthService.ts` | Auth headers for local-bridge requests |
| 26 | `frontend/src/types/index.ts` | Frontend `Product`, `Sale`, `SaleItem` interfaces |
| 27 | `frontend/src/pages/worker/POS.tsx` | Alternative POS page (uses `usePOSStore`) |
| 28 | `frontend/src/locales/en/translation.json` | English translations |
| 29 | `frontend/src/locales/fr/translation.json` | French translations |
| 30 | `frontend/src/locales/bm/translation.json` | Bambara translations |

---

## 🧠 AGENT PERSONA

You are a **10x full-stack developer** who has been the lead architect on this project since day one. You know every line of this codebase. You write surgical, minimal-diff changes. You follow these principles:

1. **Read before you write.** Always read the target file fully before editing. Understand the existing patterns.
2. **Surgical edits.** Change only what needs to change. Do not refactor unrelated code. Do not rewrite working components.
3. **Copy the supplier pattern.** The supplier side (tables, repo, routes, frontend) is the REFERENCE implementation. The client side MUST mirror it structurally. When confused, look at how `suppliers` works and replicate for `clients`.
4. **Respect the auth pyramid.** Every new endpoint or query MUST filter by `store_id` for workers. Masters can see all stores. Check `routes/utils/auth.ts` for the pattern.
5. **Migration safety.** Use `ensureColumn()` for ALTER TABLE. All new columns MUST be nullable or have defaults. Use `CREATE TABLE IF NOT EXISTS`. Never DROP or rename existing columns.
6. **i18n completeness.** Every new UI string must have keys in `en`, `fr`, and `bm` translation files.
7. **Build verification.** After each phase, confirm: `cd backend/local-bridge && npm run build` passes, AND `cd frontend && npm run build` passes.
8. **Preserve what works.** The `getProductPrice()` tier logic and `calculateLineTotal()` discount math are CORRECT. Do not modify them — only wire the missing inputs to them.

---

## 🗣️ TEAM ANALYSIS SESSION — The Problems

Below is the team analysis that produced this prompt. The team includes analysts, QA testers, client representatives, and beta testers. Read it to understand **what is broken and why**.

---

### CRITICAL FINDING: No Backend For Clients

**Lead Analyst**: The backend has 16 tables and 14 repository files. ZERO of them are for clients. The word "clients" does not appear anywhere in the backend codebase.

**Evidence trail:**
- `schema.ts` — 16 `CREATE TABLE` statements; none for `clients` or `client_services`  
- `db/repositories/` — 14 repo files; none for clients  
- `routes/` — 13 route files; none for clients  
- `SalesModule.tsx` line 140 calls `fetch(\`/rest/v1/clients?...\`)` — this always returns **404**

**Beta Tester**: "I added 50 clients in the Clients tab. Cleared my browser cache. All gone. They only lived in localStorage."

---

### CRITICAL FINDING: Client Groups Are Hardcoded Placeholders

**Analyst**: In `FichiersClientsModule.tsx` lines 49-53:

```typescript
const fetchServices = async () => {
  setServices([
    { id: 'vip', name: 'VIP', default_discount_percent: 10, ... },
    { id: 'gros', name: 'Grossiste', default_discount_percent: 15, ... },
    { id: 'public', name: 'Public', default_discount_percent: 0, ... },
  ]);
};
```

These never load from the DB. They reset every time the component mounts. If a user creates custom groups via `FichiersServicesClientsModule.tsx`, the hardcoded ones overwrite them.

---

### CRITICAL FINDING: Discount Flow Is Disconnected

There are TWO discount systems that never talk to each other:

**System A — Client Service Discounts (DEAD):**
- `ClientService.default_discount_percent` exists in the interface (useMasterDataStore)
- When a client is assigned to a service group, this discount should auto-apply
- **No code in SalesModule or usePOSStore reads `service_id` or `default_discount_percent`**

**System B — Per-Line Manual Discounts (ACTIVE):**
- `SanifereLineItem.discountPercent` is manually editable in the POS grid
- `calculateLineTotal()` correctly applies it: `subtotal × (1 - discount/100)`
- **But it's always 0 unless manually changed — never auto-populated from client group**

**The Gap:**
```
CLIENT GROUP (VIP=10%) ──── ❌ NO CONNECTION ──── SALES LINE (discount: 0)
```

When a worker types a client code in SalesModule:
1. `handleClientChange()` looks up client by code ✅
2. Sets `customerName` and `customerAddress` ✅
3. **Never reads client's `service_id`** ❌
4. **Never looks up `default_discount_percent`** ❌
5. **Never applies discount to line items** ❌

---

### HIGH FINDING: Sale Creation Ignores Client Identity

In `handlePaymentConfirm()`:
```typescript
await OfflineSalesService.createSale({
  customer_name: customerName || undefined,  // just a string
  customer_phone: undefined,                 // ALWAYS undefined!
  // ❌ No client_id
  // ❌ No discount from client group
});
```

- **No `client_id`** — sale only stores free-text `customer_name`, no FK link
- **`customer_phone` always `undefined`** — never passed from store
- Cannot track purchase history per client
- Cannot calculate client balance from sales

---

### MEDIUM FINDING: No Stock Deduction On Sale

`sales.repo.ts` `insertSale()` only INSERTs into `sales` and `sale_items`. **No `UPDATE products SET quantity = quantity - ?`**. When a sale is made, the product quantity doesn't change.

**Beta Tester**: "I sell 5 units at the POS. Check stock. Still shows the old number. I have to manually adjust."

---

### SUPPLIER vs CLIENT — Reference Comparison

| Aspect | Supplier (COMPLETE) | Client (BROKEN) |
|--------|-------------------|-----------------|
| DB Table | `suppliers` ✅ | ❌ Missing |
| Repository | `suppliers.repo.ts` ✅ | ❌ Missing |
| Routes | `routes/purchasing.ts` (includes suppliers) ✅ | ❌ Missing |
| Frontend Store | `usePurchasingStore` ✅ | `useMasterDataStore` (localStorage only) |
| Frontend UI | `FichiersFournisseursModule` ✅ | `FichiersClientsModule` (cosmetic) |
| Transaction Link | `purchase_orders.supplier_id` FK ✅ | `sales.customer_name` free text |
| Payment Tracking | `supplier_payments` table ✅ | ❌ None |
| Balance Tracking | `supplier.balance` in DB ✅ | `client.current_balance` in localStorage |

---

## 📋 IMPLEMENTATION PHASES

Execute these in order. Each phase is atomic — commit after each.

**⚠️ PHASE 0 IS THE FOUNDATION. All other phases depend on the `clients` and `client_services` tables existing.**

---

### PHASE 0: Create `clients` and `client_services` Tables + Backend Types

**THE RULE: Mirror the supplier pattern. `clients` mirrors `suppliers`. `client_services` is new. Both tables, both repos, both registered in `db/index.ts`.**

**Database tasks (in `schema.ts` → `initialize()`):**

1. Add `CREATE TABLE IF NOT EXISTS client_services`:
```sql
CREATE TABLE IF NOT EXISTS client_services (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  default_discount_percent REAL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

2. Add `CREATE TABLE IF NOT EXISTS clients`:
```sql
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

3. Add `client_id` to sales table:
```sql
ensureColumn('sales', 'client_id', `ALTER TABLE sales ADD COLUMN client_id TEXT REFERENCES clients(id)`);
```

**Also update `db.ts` (legacy) with identical tables — follow the same pattern as the other tables there.**

**Type tasks (in `db/types.ts`):**

4. Add interfaces:
```typescript
export interface LocalClient {
  id: string;
  store_id: string;
  service_id?: string | null;
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit?: number | null;
  current_balance: number;
  loyalty_points?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocalClientService {
  id: string;
  store_id: string;
  name: string;
  default_discount_percent: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
}
```

5. Add `client_id` to `LocalSale`:
```typescript
client_id?: string | null;
```

**Commit message:** `feat(clients): create clients and client_services tables with types (Phase 0)`

---

### PHASE 1: Create `clients.repo.ts` and `client_services.repo.ts`

**THE RULE: Copy `suppliers.repo.ts` structure exactly. Same pattern: `createXxxRepo(db) => ({...})`. Same CRUD methods.**

**Create `backend/local-bridge/src/db/repositories/clients.repo.ts`:**

```typescript
export const createClientsRepo = (db: Database.Database) => ({
  listClients(storeId?: string): LocalClient[] { ... },
  getClientById(clientId: string): LocalClient | undefined { ... },
  getClientByCode(code: string, storeId: string): LocalClient | undefined { ... },
  insertClient(client: LocalClient): void { ... },
  updateClient(clientId: string, updates: Partial<Omit<LocalClient, 'id' | 'store_id' | 'created_at'>>): LocalClient | undefined { ... },
  deleteClient(clientId: string): void { ... },
  updateClientBalance(clientId: string, amount: number): void { ... },
});
```

- `listClients(storeId?)`: if storeId provided, filter by it. Otherwise return all (for Master).
- `getClientByCode(code, storeId)`: for POS lookup — find by code within a store.
- `updateClientBalance(clientId, amount)`: `UPDATE clients SET current_balance = current_balance + ? WHERE id = ?` — used for credit sales and payments.

**Create `backend/local-bridge/src/db/repositories/client_services.repo.ts`:**

```typescript
export const createClientServicesRepo = (db: Database.Database) => ({
  listClientServices(storeId?: string): LocalClientService[] { ... },
  getClientServiceById(serviceId: string): LocalClientService | undefined { ... },
  insertClientService(service: LocalClientService): void { ... },
  updateClientService(serviceId: string, updates: Partial<...>): LocalClientService | undefined { ... },
  deleteClientService(serviceId: string): void { ... },
});
```

**Register in `db/index.ts`:**

Find where all other repos are assembled (e.g., `createSalesRepo(database)`, `createSuppliersRepo(database)`) and add:
```typescript
...createClientsRepo(database),
...createClientServicesRepo(database),
```

**Also update the legacy `db.ts` if it has the same assembly pattern — check and mirror.**

**Commit message:** `feat(clients): create clients.repo.ts and client_services.repo.ts (Phase 1)`

---

### PHASE 2: Create `routes/clients.ts` With Full CRUD

**THE RULE: Follow `routes/purchasing.ts` pattern for Zod validation + `authenticateRequest()` + store_id filtering.**

**Create `backend/local-bridge/src/routes/clients.ts`:**

**Endpoints to implement:**

```
GET    /rest/v1/clients?store_id=X              → list clients (Worker: own store; Master: any/all)
GET    /rest/v1/clients/:id                      → get single client
POST   /rest/v1/clients                          → create client (Master + Worker)
PATCH  /rest/v1/clients/:id                      → update client (Master + Worker)
DELETE /rest/v1/clients/:id                      → delete client (Master only)

GET    /rest/v1/client_services?store_id=X       → list client groups/services
GET    /rest/v1/client_services/:id              → get single service
POST   /rest/v1/client_services                  → create group (Master + Worker)
PATCH  /rest/v1/client_services/:id              → update group (Master + Worker)
DELETE /rest/v1/client_services/:id              → delete group (Master only)

POST   /rest/v1/client_payments                  → record a client payment (reduces balance)
```

**Zod schemas needed:**

```typescript
const clientCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  credit_limit: z.number().nullable().optional(),
  service_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const clientServiceCreateSchema = z.object({
  store_id: z.string().optional(),
  name: z.string().min(1),
  default_discount_percent: z.number().min(0).max(100).optional(),
  description: z.string().nullable().optional(),
});

const clientPaymentSchema = z.object({
  client_id: z.string().min(1),
  amount: z.number().min(0.01),
  payment_method: z.string().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
```

**Auth rules (CRITICAL):**
- Workers: can only create/view/update clients in their own `store_id`
- Masters: can see all stores, can delete
- Deliverers: no access

**Register the routes** in the main server file (find where `registerSalesRoutes(app)` etc are called and add `registerClientsRoutes(app)`).

**Client Payment logic:**
When `POST /rest/v1/client_payments` is called:
1. Validate client exists and belongs to caller's store
2. Call `db.updateClientBalance(client_id, -amount)` (negative because payment REDUCES balance)
3. Return updated client

**Commit message:** `feat(clients): create routes/clients.ts with full CRUD + payments (Phase 2)`

---

### PHASE 3: Wire Frontend to Backend API

**THE RULE: Replace all localStorage-only operations with actual API calls. Keep Zustand as a cache but sync from backend.**

**Fix `FichiersClientsModule.tsx`:**

1. Replace the empty `fetchClients()` (line 47) with an actual API call:
```typescript
const fetchClients = async () => {
  setLoading(true);
  try {
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams({ store_id: storeId });
    const res = await fetch(`${localBridgeBaseUrl}/rest/v1/clients?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setClients(data);
    }
  } catch (e) {
    console.error('Failed to fetch clients:', e);
  } finally {
    setLoading(false);
  }
};
```

2. Replace the hardcoded `fetchServices()` (lines 49-53) with an API call:
```typescript
const fetchServices = async () => {
  try {
    const headers = await OfflineAuthService.getAuthHeaders();
    if (!headers) return;
    const params = new URLSearchParams({ store_id: storeId });
    const res = await fetch(`${localBridgeBaseUrl}/rest/v1/client_services?${params}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setServices(data);
    }
  } catch (e) {
    console.error('Failed to fetch services:', e);
  }
};
```

3. Update `handleSave()` to POST/PATCH the backend:
```typescript
const handleSave = async () => {
  // ... validation ...
  const headers = await OfflineAuthService.getAuthHeaders();
  const method = editingClient ? 'PATCH' : 'POST';
  const url = editingClient 
    ? `${localBridgeBaseUrl}/rest/v1/clients/${editingClient.id}`
    : `${localBridgeBaseUrl}/rest/v1/clients`;
  
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ...formData, store_id: storeId }),
  });
  
  if (res.ok) {
    await fetchClients(); // Refresh from backend
    // ... success toast ...
  }
};
```

4. Update `handleDelete()` to DELETE via API, then refresh.

**Fix `FichiersServicesClientsModule.tsx`:**

5. Same pattern — replace Zustand-only CRUD with API calls to `/rest/v1/client_services`.

**Fix `SalesModule.tsx` client fetch (line ~133-150):**

6. The existing fetch at line 140 (`/rest/v1/clients?store_id=...`) will now WORK because Phase 2 created the route. No code change needed here if the fetch pattern already matches. Verify the response shape matches the `Client` interface in `useMasterDataStore.ts`. If not, map the fields.

**Commit message:** `feat(clients): wire frontend CRUD to backend API (Phase 3)`

---

### PHASE 4: Auto-Apply Client Group Discount in SalesModule

**THE RULE: When a worker selects a client (by code or name), look up their service group's `default_discount_percent` and apply it to ALL current and future line items in the session.**

**This is the MOST IMPORTANT phase for user-facing value.**

**Modify `SalesModule.tsx` → `handleClientChange()`:**

Current behavior (lines ~167-184):
```typescript
const handleClientChange = useCallback((field, value) => {
  if (field === 'code') {
    updates = { customerCode: value };
    const client = clients.find(c => c.code?.toLowerCase() === value.toLowerCase());
    if (client) {
      updates.customerName = client.name;
      updates.customerAddress = client.address || '';
    }
  }
  // ...
  updateSession(mode, updates);
}, [clients, mode, updateSession]);
```

**New behavior:**
```typescript
const handleClientChange = useCallback((field, value) => {
  let updates: any = {};
  let matchedClient: Client | undefined;

  if (field === 'code') {
    updates.customerCode = value;
    matchedClient = clients.find(c => c.code?.toLowerCase() === value.toLowerCase());
  } else if (field === 'name') {
    updates.customerName = value;
    matchedClient = clients.find(c => c.name.toLowerCase() === value.toLowerCase());
  }

  if (matchedClient) {
    updates.customerCode = matchedClient.code || updates.customerCode || '';
    updates.customerName = matchedClient.name || updates.customerName || '';
    updates.customerAddress = matchedClient.address || '';
    // Store client_id for sale creation
    updates.clientId = matchedClient.id;

    // AUTO-APPLY DISCOUNT from client's service group
    const service = services.find(s => s.id === matchedClient!.service_id);
    const groupDiscount = service?.default_discount_percent || 0;

    if (groupDiscount > 0 && lineItems.length > 0) {
      const updatedItems = lineItems.map(item => ({
        ...item,
        discountPercent: groupDiscount,
        lineTotal: calculateLineTotal(item.unitPrice, item.quantity, groupDiscount),
      }));
      updates.lineItems = updatedItems;
    }
    
    // Store the discount for future items added in this session
    updates.clientDiscount = groupDiscount;
  } else {
    // Client cleared — reset discount on all items
    if (field === 'code' && !value) {
      updates.clientId = undefined;
      updates.clientDiscount = 0;
      if (lineItems.length > 0) {
        const updatedItems = lineItems.map(item => ({
          ...item,
          discountPercent: 0,
          lineTotal: calculateLineTotal(item.unitPrice, item.quantity, 0),
        }));
        updates.lineItems = updatedItems;
      }
    }
  }

  updateSession(mode, updates);
}, [clients, services, lineItems, mode, updateSession]);
```

**Also modify `addProduct()` to use the stored client discount:**

When a new product is added to the grid, if `currentSession.clientDiscount > 0`, set `discountPercent` to that value instead of 0:

```typescript
const addProduct = useCallback((product: Product) => {
  const clientDiscount = currentSession.clientDiscount || 0;
  // ... existing logic ...
  const newItem: SanifereLineItem = {
    // ... existing fields ...
    discountPercent: clientDiscount,  // ← was hardcoded to 0
    lineTotal: calculateLineTotal(price, 1, clientDiscount),  // ← was calculateLineTotal(price, 1, 0)
  };
  // ...
}, [lineItems, mode, updateSession, activeTier, currentSession]);
```

**Update `useSalesStore.ts` `SalesSessionState` interface:**

Add two new fields:
```typescript
export interface SalesSessionState {
  // ... existing fields ...
  clientId?: string;       // FK to clients table
  clientDiscount?: number; // auto-applied discount % from client group
}
```

**Update `DEFAULT_SESSION`:**
```typescript
export const DEFAULT_SESSION: SalesSessionState = {
  // ... existing fields ...
  clientId: undefined,
  clientDiscount: 0,
};
```

**Numeric verification:**
```
Client "Boubacar" → VIP group → default_discount_percent = 10%

Worker types "Boubacar" → handleClientChange fires
  → finds client → service_id = 'vip' → discount = 10%
  → All existing items: discountPercent = 10, lineTotal recalculated
  → Session stores clientDiscount = 10

Worker adds Fanta (unit_price=100F):
  → discountPercent = 10 (from clientDiscount)
  → lineTotal = 100 × 1 × (1 - 10/100) = 90F ✅

Worker can still manually override discount on any line ✅
```

**Commit message:** `feat(sales): auto-apply client group discount in SalesModule (Phase 4)`

---

### PHASE 5: Fix Sale Creation — Pass `client_id`, `customer_phone`, and Stock Deduction

**Three sub-fixes in one phase.**

**Fix A — Pass `client_id` in sale payload:**

In `SalesModule.tsx` → `handlePaymentConfirm()`, update the `OfflineSalesService.createSale()` call:

```typescript
await OfflineSalesService.createSale({
  store_id: storeId,
  worker_id: user?.id || '',
  client_id: currentSession.clientId || undefined,   // ← NEW
  items: cartItems,
  total_price: netTotal,
  payment_method: paymentMethod,
  sale_type: saleType,
  customer_name: customerName || undefined,
  customer_phone: undefined,  // TODO: wire from client.phone if available
  discount: currentSession.clientDiscount || 0,      // ← NEW: sale-level discount
});
```

**Update `OfflineSalesService.ts` → `CreateSalePayload`:**
```typescript
export interface CreateSalePayload {
  // ... existing fields ...
  client_id?: string;
  discount?: number;
}
```

Update the `smartFetch` POST body to include `client_id` and `discount`.

**Update `routes/sales.ts` → `saleCreateSchema`:**
```typescript
const saleCreateSchema = z.object({
  // ... existing fields ...
  client_id: z.string().nullable().optional(),
});
```

Update the route handler to pass `client_id` to `db.insertSale()`.

**Fix B — Pass `customer_phone`:**

In `handlePaymentConfirm()`, if `currentSession.clientId` is set, look up the client's phone:
```typescript
const matchedClient = clients.find(c => c.id === currentSession.clientId);
// ...
customer_phone: matchedClient?.phone || undefined,
```

**Fix C — Stock Deduction:**

In `routes/sales.ts` → `POST /rest/v1/sales`, after inserting all sale items, add stock deduction:

```typescript
// After inserting sale items
items.forEach((item) => {
  if (item.product_id) {
    db.prepare(`UPDATE products SET quantity = MAX(0, quantity - ?) WHERE id = ? AND store_id = ?`)
      .run(item.quantity, item.product_id, storeId);
  }
});
```

**IMPORTANT:** Use `MAX(0, quantity - ?)` to prevent negative stock. Filter by `store_id` to enforce auth at the query level.

**Fix D — Credit Sale Balance Update:**

If `payment_method === 'credit'` and `client_id` is provided:
```typescript
if (parsed.data.payment_method === 'credit' && parsed.data.client_id) {
  db.updateClientBalance(parsed.data.client_id, parsed.data.total_price || 0);
}
```

This increases the client's `current_balance` by the sale total.

**Commit message:** `fix(sales): pass client_id, fix customer_phone, add stock deduction and credit balance (Phase 5)`

---

### PHASE 6: i18n + Seed Default Client Groups + Final Cleanup

**i18n — Add missing translation keys:**

Verify and add these keys in ALL THREE locale files (`en`, `fr`, `bm`):

**English (`en/translation.json`):**
```json
{
  "menu.program.clientPayment": "Client Payment",
  "menu.program.recordPayment": "Record Payment",
  "menu.program.paymentAmount": "Payment Amount",
  "menu.program.paymentReference": "Reference",
  "menu.program.paymentHistory": "Payment History",
  "menu.program.creditSale": "Credit Sale",
  "menu.program.clientBalance": "Outstanding Balance",
  "menu.program.overCreditLimit": "Over Credit Limit!",
  "menu.program.autoDiscount": "Auto-discount applied: {{percent}}%",
  "menu.program.groupDiscount": "Group Discount",
  "menu.program.vipGroup": "VIP",
  "menu.program.grocerGroup": "Grocer",
  "menu.program.publicGroup": "Public"
}
```

**French (`fr/translation.json`):**
```json
{
  "menu.program.clientPayment": "Paiement Client",
  "menu.program.recordPayment": "Enregistrer le paiement",
  "menu.program.paymentAmount": "Montant du paiement",
  "menu.program.paymentReference": "Référence",
  "menu.program.paymentHistory": "Historique des paiements",
  "menu.program.creditSale": "Vente à crédit",
  "menu.program.clientBalance": "Solde en cours",
  "menu.program.overCreditLimit": "Limite de crédit dépassée !",
  "menu.program.autoDiscount": "Remise auto appliquée : {{percent}}%",
  "menu.program.groupDiscount": "Remise du groupe",
  "menu.program.vipGroup": "VIP",
  "menu.program.grocerGroup": "Grossiste",
  "menu.program.publicGroup": "Public"
}
```

**Bambara (`bm/translation.json`):**
```json
{
  "menu.program.clientPayment": "Kliyan sara",
  "menu.program.recordPayment": "Sara sɛbɛn",
  "menu.program.paymentAmount": "Sara hakɛ",
  "menu.program.paymentReference": "Taamashyɛli",
  "menu.program.paymentHistory": "Sara tariku",
  "menu.program.creditSale": "Juru feere",
  "menu.program.clientBalance": "Juru hakɛ",
  "menu.program.overCreditLimit": "Juru dantɛmɛ tɛmɛna!",
  "menu.program.autoDiscount": "Bɔli otomatiki: {{percent}}%",
  "menu.program.groupDiscount": "Kulu bɔli",
  "menu.program.vipGroup": "VIP",
  "menu.program.grocerGroup": "Julakɛla",
  "menu.program.publicGroup": "Bɛɛ"
}
```

**Seed default client groups:**

In the backend route `GET /rest/v1/client_services?store_id=X`, if the result is empty AND this is the first request for that store, auto-seed 3 default groups:

```typescript
let services = db.listClientServices(storeId);
if (services.length === 0) {
  const now = new Date().toISOString();
  const defaults = [
    { id: crypto.randomUUID(), store_id: storeId, name: 'VIP', default_discount_percent: 10, description: null, created_at: now, updated_at: now },
    { id: crypto.randomUUID(), store_id: storeId, name: 'Grossiste', default_discount_percent: 15, description: null, created_at: now, updated_at: now },
    { id: crypto.randomUUID(), store_id: storeId, name: 'Public', default_discount_percent: 0, description: null, created_at: now, updated_at: now },
  ];
  defaults.forEach(s => db.insertClientService(s));
  services = defaults;
}
return reply.send(services);
```

This replaces the hardcoded placeholder in `FichiersClientsModule.tsx` — groups now live in the database and are editable/persistent.

**Final cleanup:**

- Remove the hardcoded `fetchServices()` in `FichiersClientsModule.tsx` (the one with the 3 fake groups) — it's replaced by the real API call from Phase 3
- Verify that `FichiersClientsModule.tsx` `handleSave()` no longer only writes to Zustand — it must POST/PATCH the backend

**Commit message:** `feat(clients): i18n, seed default groups, cleanup hardcoded placeholders (Phase 6)`

---

## ✅ FINAL CHECKLIST

After all phases:

- [ ] `cd backend/local-bridge && npm run build` — zero errors
- [ ] `cd frontend && npm run build` — zero errors
- [ ] **`clients` table exists** in SQLite with correct schema
- [ ] **`client_services` table exists** with 3 seeded default groups per store
- [ ] `GET /rest/v1/clients?store_id=X` returns clients for that store
- [ ] `POST /rest/v1/clients` creates a client in the database
- [ ] Worker in Store A cannot see clients from Store B
- [ ] Master can see all stores' clients
- [ ] **Client groups persist** across browser cache clear and app restart
- [ ] **VIP discount auto-applies** when VIP client selected in SalesModule
- [ ] Clearing client code in POS resets discount to 0 on all lines
- [ ] Worker can still manually override discount per line (existing behavior preserved)
- [ ] `getProductPrice()` tier logic is UNTOUCHED and still works
- [ ] Sale records include `client_id` FK when a client was selected
- [ ] `customer_phone` is populated from client record (no longer always undefined)
- [ ] **Stock quantity decrements** when a sale is created
- [ ] Credit sale increases `client.current_balance`
- [ ] Client payment (`POST /rest/v1/client_payments`) decreases balance
- [ ] All new UI strings exist in `en`, `fr`, `bm` locales
- [ ] No hardcoded client groups remaining in frontend code
- [ ] Update `memory-bank/core/tasks.md` with all completed tasks
- [ ] Update `memory-bank/core/context/activeContext.md` with new state
