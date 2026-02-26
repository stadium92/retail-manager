# Lovable.dev Prompt: Store & Inventory Deep Dive Enhancements

## Project Context

You are working on an **existing React + TypeScript + Supabase retail management application**. Core flows (auth, role-based dashboards, CRUD for stores/inventory/sales/workers/deliveries) already exist. The goal now is to enrich data visibility across stores, inventory, sales, and worker views so managers and staff can immediately see which store a record belongs to and the key people/products tied to it.

### ✅ Already Built (DO NOT REBUILD)
- Authentication and protected routing (`AuthContext`, `ProtectedRoute`)
- Master dashboard with analytics, AI tabs, navigation, and monthly goals
- CRUD pages for Stores, Inventory, Sales, Workers, Deliverers, Deliveries
- Deliverer map integration and real-time delivery updates
- Image upload system, Supabase Storage integration
- i18n (English, French, Bambara) and language switcher in layout
- Service layer (`StoreService`, `InventoryService`, `SalesService`, `GoalService`, etc.)

### 🎯 Enhancements to Implement
1. **Store Detail Pages** – Clicking a store should open a detail view showing assigned workers, inventory, recent sales, and store metadata.
2. **Inventory Store Visibility** – Inventory list should clearly indicate the store each item belongs to, with filtering and quick navigation.
3. **Sales Store Performance** – Sales dashboard should surface store-by-store performance metrics and allow drilling into store-specific sales.
4. **Worker Store Assignments** – Worker list and detail views should display which store(s) each worker is assigned to, with quick access to store info.

---

## Task 1: Store Detail Page

### Requirements
- **Entry Points**: From `Stores` index page (grid/table cards) add a “View Details” action that navigates to `/master/stores/:id`.
- **Page Layout (`StoreDetails.tsx`)**:
  - Header: Store name, location, contact, status, created/updated timestamps.
  - Tabs or sections:
    1. **Overview**: Store photo (if available), description, manager/contact info, operating hours (if captured), KPIs (today/week sales, low-stock count, pending deliveries).
    2. **Workers**: List of assigned workers with role, email, phone, shifts. Provide quick link to worker detail.
    3. **Inventory**: Table of items belonging to the store (name, SKU, quantity, low stock alert). Enable quick edit/open item.
    4. **Sales**: Recent sales for the store (date, worker, total, items). Include top-selling products summary.
    5. **Deliveries**: Current/past deliveries linked to the store with status and deliverer info.
  - **Actions**: Edit store, manage workers (open assignment dialog), manage inventory.

### Implementation
- **Routes**: Add `<Route path="stores/:id" element={<StoreDetailsPage />} />` in master routes.
- **Service**: Extend `StoreService` with `getStoreWithRelations(id)` selecting store plus related workers, inventory, sales, deliveries.
- **Components**: Create `StoreDetails.tsx` under `src/pages/master/stores` (or similar). Use existing UI primitives (cards, tabs, data tables).
- **Fallbacks**: Show skeleton/loader while data loads. Handle store-not-found gracefully.

---

## Task 2: Inventory – Store Context

### Requirements
- **List Enhancements**:
  - Add `Store` column showing store name (with badge/chip).
  - Filter by store using dropdown/select.
  - Provide quick link: clicking store name navigates to store detail.
- **Item Detail Panel/Modal**:
  - Display store information (name, address) and worker(s) responsible (if tracked).
  - Include low-stock threshold and reorder suggestions with store context.
- **Empty State & Analytics**:
  - Summary cards showing item counts per store, low-stock per store.

### Implementation
- Update inventory fetch to join `stores` table (via Supabase `select('*, stores(name, address)')`).
- Add store filter state and update query accordingly.
- Extend `InventoryService.getInventory` to accept `storeId` and return store data.
- Create `StoreFilter` component reused across inventory and worker views.

---

## Task 3: Sales Interface – Store Performance

### Requirements
- **Metrics Cards**: Add store-level performance snapshots (e.g., top-performing store today/week, revenue by store).
- **Store Selector**: Allow filtering main sales table and charts by store.
- **Leaderboard**: Add table showing each store with total revenue, number of sales, avg sale value for selected period.
- **Store Detail Link**: Clicking store name navigates to store detail page.

### Implementation
- Extend `SalesService.getSales` to join store info (store id, name) and support grouping.
- Calculate store-level aggregates (total sales, trending vs previous period).
- Add charts (bar/pie) for sales by store (use existing charting library).
- Ensure filters (date range, worker) interact correctly with store filter.

---

## Task 4: Worker Interface – Store Assignments

### Requirements
- **Worker List**: Add column showing assigned store(s) with chips. Allow filtering workers by store.
- **Worker Detail Drawer/Modal**: Show store assignment(s) with quick link and responsibilities (role, shift, KPIs).
- **Assignment Management**: Provide “Assign to Store” action (reuse existing dialogs or improved UI).
- **Activity Overview**: Show recent sales per worker broken down by store (today/week).

### Implementation
- Update worker query to include store relations via `user_roles` join.
- Add store filter dropdown (reuse `StoreFilter` component).
- Enhance worker detail view with store info and performance stats (calls to `SalesService` filtered by worker).

---

## Cross-cutting Considerations

- **Navigation & Routing**: Ensure `StoreDetails` page is added to sidebar or accessible via breadcrumbs. Update page breadcrumbs to reflect active store.
- **Loading & Error States**: Reuse `Skeleton`, `Alert`, and `Empty` components. Ensure store filters persist selection.
- **i18n**: Wrap new text with `t()` and add keys to `en/fr/bm` translation files.
- **Access Control**: Master role can access all store details. Workers/deliverers should only see stores they belong to (if store detail exposed to them later).
- **Testing Checklist**:
  - Navigate to store detail from stores list, inventory, sales, and worker pages.
  - Verify inventory and sales filters update correctly and display store names.
  - Check mobile responsiveness for the new detail views.
  - Validate Supabase queries (especially joins) perform within limits; add indexes if needed (`user_roles.store_id`, `sales.store_id`).

---

## Implementation Order (Suggested)
1. Create `StoreDetails` page and routing.
2. Update inventory list & detail to show store context.
3. Enhance sales interface with store performance metrics.
4. Update worker interface for store assignments.
5. Polish UI/UX, add i18n keys, and run regression tests.

---

## Deliverables
- `src/pages/master/stores/StoreDetails.tsx` (new)
- Updates to `Stores.tsx`, `Inventory.tsx`, `Sales.tsx`, `Workers.tsx`
- Service updates (`StoreService`, `InventoryService`, `SalesService`)
- Shared `StoreFilter` component (if needed)
- Translation updates for new labels
- Documentation section in `FRONTEND_STATUS_ANALYSIS.md` (optional) summarizing new store deep-dive capabilities



