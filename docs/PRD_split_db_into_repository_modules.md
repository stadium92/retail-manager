# PRD: Split db.ts into Repository Modules

## Summary

Refactor the monolithic `backend/local-bridge/src/db.ts` (2,193 lines, 1 class, 70+ methods) into a modular repository pattern with domain-specific files. This is a **zero-new-logic** reorganization — no features are added, removed, or changed.

## Background

The `LocalBridgeDatabase` class in `db.ts` currently handles:
- Database connection & initialization (constructor, `initialize()`, `migrate()`)
- Schema creation (18 tables, 18 indexes, FTS5 virtual table, 3 triggers)
- 70+ data-access methods spanning 10+ business domains
- 19 exported TypeScript interfaces

This file has grown organically as features were added (products, sales, deliveries, purchasing, analytics, audit, scheduling, replenishment). Every route file (`auth.ts`, `products.ts`, `sales.ts`, etc.) imports from the same `db.ts`, making it a bottleneck for readability, navigation, and future collaboration.

## Problem Statement

| Problem | Impact |
|---------|--------|
| 2,193 lines in one file | Hard to navigate; slow to understand for new contributors |
| All domains coupled in one class | Cannot reason about products without scrolling past auth, sales, deliveries |
| Merge conflicts | Any two developers working on different domains will conflict on the same file |
| Testing difficulty | Cannot unit-test sales repository logic in isolation |
| Cognitive load | A developer fixing a delivery bug must parse 70+ unrelated methods |

## Goals

1. Split `db.ts` into **domain-specific repository modules** with clear boundaries
2. **Zero behavioral changes** — all existing routes continue to work identically
3. Maintain the **single database connection** (shared `better-sqlite3` instance)
4. Keep all existing **TypeScript interfaces** accessible via clean imports
5. Enable future **unit testing** of individual repository modules

## Non-Goals

- Adding new database features or tables
- Changing the database schema
- Migrating away from better-sqlite3
- Adding an ORM (Drizzle, Prisma, etc.)
- Changing the API contract between routes and the database layer

## Target Architecture

### Current Structure
```
src/
  db.ts                    ← 2,193 lines (everything)
  routes/
    auth.ts                ← imports { db } from '../db.js'
    products.ts            ← imports { db } from '../db.js'
    sales.ts               ← imports { db } from '../db.js'
    ... (14 route files)
```

### Proposed Structure
```
src/
  db/
    index.ts               ← Re-exports everything (backward-compatible barrel)
    connection.ts           ← Database connection, constructor, WAL setup
    schema.ts               ← initialize() — all CREATE TABLE, indexes, triggers
    migrations.ts           ← migrate() — ALTER TABLE additions, ensureColumn
    types.ts                ← All 19 exported interfaces
    repositories/
      auth.repo.ts          ← Users, roles, sessions
      stores.repo.ts        ← Stores
      products.repo.ts      ← Products, product families, FTS search
      suppliers.repo.ts     ← Suppliers
      purchasing.repo.ts    ← Purchase orders, purchase items, supplier payments
      sales.repo.ts         ← Sales, sale items
      deliveries.repo.ts    ← Deliveries
      inventory.repo.ts     ← Inventory movements
      sync.repo.ts          ← Pending mutations
      analytics.repo.ts     ← Revenue, top products, top workers, stock valuation
      replenishment.repo.ts ← Replenishment requests, replenishment needs
      scheduling.repo.ts    ← Scheduled orders, scheduled order items
      audit.repo.ts         ← Audit logs
      invitations.repo.ts   ← Worker invitations
```

## Detailed Module Breakdown

### 1. `db/connection.ts` (~80 lines)
**Responsibility**: Database connection lifecycle

Contains:
- `LocalBridgeDatabase` class (slim version — connection only)
- Constructor logic: data dir creation, `pkg` detection, native binding resolution
- WAL mode + PRAGMA settings
- `dbFile` getter
- Exports single `db` instance

```typescript
// connection.ts
import Database from 'better-sqlite3';
import { env } from '../env.js';

class LocalBridgeDatabase {
  public readonly db: Database.Database;
  private readonly dbPath: string;

  constructor() { /* existing constructor logic */ }
  get dbFile() { return this.dbPath; }
}

export const dbInstance = new LocalBridgeDatabase();
export const rawDb = dbInstance.db;
```

### 2. `db/schema.ts` (~350 lines)
**Responsibility**: Table creation and index setup

Contains:
- `initializeSchema(db: Database.Database)` function
- All 18 `CREATE TABLE IF NOT EXISTS` statements
- All 18 `CREATE INDEX IF NOT EXISTS` statements
- FTS5 virtual table + triggers
- `ensureColumn()` helper and all `ALTER TABLE ADD COLUMN` migrations

### 3. `db/migrations.ts` (~40 lines)
**Responsibility**: Runtime migrations and trigger recreation

Contains:
- `runMigrations(db: Database.Database)` function  
- Trigger recreation logic (e.g., `sale_items_ai`)

### 4. `db/types.ts` (~280 lines)
**Responsibility**: All TypeScript interfaces

Contains (moved as-is):
- `LocalUser`, `LocalRole`, `LocalSession`, `LocalStore`
- `LocalWorkerInvitation`, `LocalProductFamily`, `LocalProduct`
- `LocalSupplier`, `LocalPurchaseOrder`, `LocalPurchaseItem`
- `LocalSupplierPayment`, `LocalDelivery`, `LocalSale`, `LocalSaleItem`
- `LocalScheduledOrder`, `LocalScheduledOrderItem`
- `LocalInventoryMovement`, `LocalPendingMutation`
- `LocalReplenishmentRequest`, `LocalAuditLog`, `ReplenishmentNeed`
- `sanitizeString` utility

### 5. Repository Modules

Each repository follows this pattern:

```typescript
// Example: repositories/products.repo.ts
import Database from 'better-sqlite3';
import { LocalProduct, LocalProductFamily, sanitizeString } from '../types.js';

export function createProductsRepo(db: Database.Database) {
  return {
    listProducts(storeId: string): LocalProduct[] { /* existing logic */ },
    listAllProducts(): LocalProduct[] { /* existing logic */ },
    searchProducts(storeId, query, limit, offset, filter): { data; total } { /* existing */ },
    getProductById(productId: string): LocalProduct | undefined { /* existing */ },
    insertProduct(product: LocalProduct) { /* existing */ },
    deleteProduct(productId: string) { /* existing */ },
    listProductFamilies(storeId: string): LocalProductFamily[] { /* existing */ },
    getProductFamilyById(familyId: string): LocalProductFamily | undefined { /* existing */ },
    insertProductFamily(family: LocalProductFamily) { /* existing */ },
    deleteProductFamily(familyId: string) { /* existing */ },
  };
}

export type ProductsRepo = ReturnType<typeof createProductsRepo>;
```

#### Method-to-Module Mapping

| Repository | Methods | Source Lines (approx) |
|-----------|---------|----------------------|
| **auth.repo.ts** | `getMasterUser`, `getUserByEmail`, `getUserById`, `getRolesForUser`, `insertUser`, `listUsers`, `listUserRoles`, `insertRole`, `getSessionByRefreshToken`, `createSession`, `updateSessionTokens`, `deleteSession`, `deleteExpiredSessions` | ~100 lines |
| **stores.repo.ts** | `getStoreById`, `getStoreByName`, `listStores`, `listStoresByOwner`, `insertStore`, `deleteStore` | ~80 lines |
| **products.repo.ts** | `listProducts`, `listAllProducts`, `searchProducts`, `getProductById`, `insertProduct`, `deleteProduct`, `listProductFamilies`, `getProductFamilyById`, `insertProductFamily`, `deleteProductFamily` | ~280 lines |
| **suppliers.repo.ts** | `listSuppliers`, `getSupplierById`, `insertSupplier`, `deleteSupplier` | ~70 lines |
| **purchasing.repo.ts** | `listPurchaseOrders`, `getPurchaseOrderById`, `insertPurchaseOrder`, `deletePurchaseOrder`, `listPurchaseItems`, `insertPurchaseItem`, `deletePurchaseItem`, `listSupplierPayments`, `insertSupplierPayment` | ~180 lines |
| **sales.repo.ts** | `listSales`, `getSaleById`, `insertSale`, `deleteSale`, `listSaleItems`, `insertSaleItem` | ~150 lines |
| **deliveries.repo.ts** | `listDeliveries`, `getDeliveryById`, `insertDelivery`, `deleteDelivery` | ~120 lines |
| **inventory.repo.ts** | `listInventoryMovements`, `insertInventoryMovement` | ~60 lines |
| **sync.repo.ts** | `listPendingMutations`, `insertPendingMutation`, `updatePendingMutationStatus` | ~50 lines |
| **analytics.repo.ts** | `getDailyRevenue`, `getWeeklyRevenue`, `getTopProducts`, `getTopWorkers`, `getStockValuation` | ~90 lines |
| **replenishment.repo.ts** | `listReplenishmentRequests`, `insertReplenishmentRequest`, `getReplenishmentNeeds` | ~130 lines |
| **scheduling.repo.ts** | `listScheduledOrders`, `insertScheduledOrder`, `deleteScheduledOrder`, `listScheduledOrderItems`, `insertScheduledOrderItem` | ~60 lines |
| **audit.repo.ts** | `insertAuditLog`, `listAuditLogs` | ~70 lines |
| **invitations.repo.ts** | `listInvitations`, `getInvitationById`, `getInvitationByToken`, `insertInvitation` | ~50 lines |

### 6. `db/index.ts` — The Barrel (Backward Compatibility Layer)

```typescript
// db/index.ts — Drop-in replacement for the old db.ts
import { rawDb, dbInstance } from './connection.js';
import { initializeSchema } from './schema.js';
import { runMigrations } from './migrations.js';
import { createAuthRepo } from './repositories/auth.repo.js';
import { createStoresRepo } from './repositories/stores.repo.js';
import { createProductsRepo } from './repositories/products.repo.js';
import { createSuppliersRepo } from './repositories/suppliers.repo.js';
import { createPurchasingRepo } from './repositories/purchasing.repo.js';
import { createSalesRepo } from './repositories/sales.repo.js';
import { createDeliveriesRepo } from './repositories/deliveries.repo.js';
import { createInventoryRepo } from './repositories/inventory.repo.js';
import { createSyncRepo } from './repositories/sync.repo.js';
import { createAnalyticsRepo } from './repositories/analytics.repo.js';
import { createReplenishmentRepo } from './repositories/replenishment.repo.js';
import { createSchedulingRepo } from './repositories/scheduling.repo.js';
import { createAuditRepo } from './repositories/audit.repo.js';
import { createInvitationsRepo } from './repositories/invitations.repo.js';

// Re-export all types
export * from './types.js';

// Initialize
initializeSchema(rawDb);
runMigrations(rawDb);

// Compose the db object with the same interface as before
export const db = {
  db: rawDb,
  get dbFile() { return dbInstance.dbFile; },
  ...createAuthRepo(rawDb),
  ...createStoresRepo(rawDb),
  ...createProductsRepo(rawDb),
  ...createSuppliersRepo(rawDb),
  ...createPurchasingRepo(rawDb),
  ...createSalesRepo(rawDb),
  ...createDeliveriesRepo(rawDb),
  ...createInventoryRepo(rawDb),
  ...createSyncRepo(rawDb),
  ...createAnalyticsRepo(rawDb),
  ...createReplenishmentRepo(rawDb),
  ...createSchedulingRepo(rawDb),
  ...createAuditRepo(rawDb),
  ...createInvitationsRepo(rawDb),
};
```

**Critical**: All route files currently import `{ db } from '../db.js'`. With the barrel file, the ONLY change needed in routes is updating the import path from `'../db.js'` to `'../db/index.js'` (or just `'../db/index.js'` which resolves automatically if using directory imports).

## Implementation Plan

### Phase 1: Setup & Types (Est: 30 min)
1. Create `src/db/` directory
2. Move all 19 interfaces + `sanitizeString` to `db/types.ts`
3. Create `db/connection.ts` with constructor logic
4. Create `db/schema.ts` with `initialize()` logic
5. Create `db/migrations.ts` with `migrate()` logic
6. Verify: `npm run build` passes

### Phase 2: Extract Repositories (Est: 2-3 hours)
Extract in this order (least dependencies first):
1. `audit.repo.ts` (2 methods, no cross-domain deps)
2. `sync.repo.ts` (3 methods, no cross-domain deps)
3. `invitations.repo.ts` (4 methods)
4. `auth.repo.ts` (13 methods)
5. `stores.repo.ts` (6 methods)
6. `inventory.repo.ts` (2 methods)
7. `suppliers.repo.ts` (4 methods)
8. `scheduling.repo.ts` (5 methods)
9. `analytics.repo.ts` (5 methods)
10. `purchasing.repo.ts` (9 methods)
11. `deliveries.repo.ts` (4 methods)
12. `sales.repo.ts` (6 methods)
13. `replenishment.repo.ts` (3 methods)
14. `products.repo.ts` (10 methods — largest, extract last)

### Phase 3: Wire the Barrel (Est: 30 min)
1. Create `db/index.ts` composing all repositories
2. Update all 14 route files to import from `'../db/index.js'`
3. Update `scheduler.ts`, `seed.ts` if they import from `db.ts`
4. Delete the old `db.ts`

### Phase 4: Verify (Est: 30 min)
1. `npm run build` — zero TypeScript errors
2. `npm run dev` — server starts, all routes respond
3. Manual smoke test every route category (auth, products, sales, deliveries)
4. Git commit: `refactor: split monolithic db.ts into repository modules`

## Route Import Changes

| Route File | Current Import | New Import |
|-----------|---------------|------------|
| `routes/auth.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/products.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/sales.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/deliveries.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/purchasing.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/analytics.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/audit.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/stores.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/sync.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/team.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/invitations.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/system.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `routes/emergency.ts` | `import { db } from '../db.js'` | `import { db } from '../db/index.js'` |
| `scheduler.ts` | `import { db } from './db.js'` | `import { db } from './db/index.js'` |
| `seed.ts` | `import { db } from './db.js'` | `import { db } from './db/index.js'` |

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Import paths break after restructuring | Medium | Barrel file (`index.ts`) re-exports `db` with identical interface |
| `this.db` references break when extracted to standalone functions | High | All methods use `db` parameter (injected), not `this.db` |
| Some methods reference other methods (`getReplenishmentNeeds` calls product/supplier queries) | Medium | Cross-repo calls go through the composed `db` object, or accept `db` as a parameter for the raw SQL queries |
| `pkg` build breaks with new file structure | Low | `pkg` bundles from compiled JS; directory structure doesn't affect it |
| Seeds/scheduler need `initialize()` timing | Low | `index.ts` runs `initializeSchema` and `runMigrations` at import time (same as current behavior) |

## Success Criteria

- [ ] `npm run build` produces zero errors
- [ ] `npm run dev` starts the server successfully
- [ ] All 14 route categories respond correctly
- [ ] No file in `src/db/` exceeds 350 lines
- [ ] Old `db.ts` is deleted
- [ ] Every repository module can be imported independently
- [ ] The composed `db` object in `index.ts` has the same TypeScript type as the old `LocalBridgeDatabase` class

## Estimated Effort

| Task | Time |
|------|------|
| Phase 1: Setup & Types | 30 min |
| Phase 2: Extract Repositories | 2-3 hours |
| Phase 3: Wire Barrel & Update Imports | 30 min |
| Phase 4: Verify & Smoke Test | 30 min |
| **Total** | **3.5-4.5 hours** |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Factory function pattern (`createXRepo(db)`) over class inheritance | Simpler, no `this` binding issues, tree-shakable, easier to test with mock db |
| Barrel file for backward compatibility | Minimizes changes in route files — single import path change |
| No ORM introduction | Out of scope; this is a structural refactor only |
| Keep `sanitizeString` in `types.ts` | Used by multiple repositories; shared utility |
| Extract in dependency order (leaf modules first) | Reduces merge conflicts; each step independently verifiable |
