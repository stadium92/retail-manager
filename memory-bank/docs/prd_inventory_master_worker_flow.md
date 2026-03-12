<context>
# Overview  
This PRD addresses the current inventory creation and master‑page loading failures by defining the database flow, role hierarchy, and item lifecycle across cloud and offline modes. The product serves store owners (masters) and staff (workers/deliverers) who need reliable sales and inventory operations regardless of connectivity. The value is consistent item placement, predictable updates, and clear master/worker responsibilities.

# Core Features  
- **Master/Worker hierarchy and access**  
  - What: Explicit role and store scoping for all data access.  
  - Why: Prevents missing data and authorization errors.  
  - How: `user_roles` binds users to stores; routes enforce store_id.

- **Item creation and propagation**  
  - What: Every new product appears in inventory and all relevant screens.  
  - Why: Missing inventory breaks POS and reporting.  
  - How: Item creation writes to `products` (cloud) or LocalBridge `products` (offline) and syncs local cache.

- **Sales and inventory impact**  
  - What: Sales reduce stock, deliveries increase stock.  
  - Why: Keeps inventory accurate.  
  - How: `sales` + `sale_items` are append-only; stock uses `products.quantity` with clear update rules.

- **Offline-first continuity**  
  - What: Operations work without internet; syncs on reconnect.  
  - Why: Field stores cannot rely on cloud availability.  
  - How: LocalBridge + IndexedDB cache + sync queue.

# User Experience  
- **Personas**  
  - Master: manages stores, products, workers, analytics.  
  - Worker: creates products (if permitted), records sales, checks stock.  
  - Deliverer: updates delivery status.

- **Key user flows**  
  1. Master signs in → selects/creates store → sets up product families/products.  
  2. Worker signs in → sees assigned store catalog → records sales.  
  3. Delivery updates stock when received.  
  4. Offline use → local writes → sync when online.

- **UI/UX considerations**  
  - Clear offline badge and sync state.  
  - Store context always visible for master screens.  
  - Immediate confirmation when an item is created.
</context>
<PRD>
# Technical Architecture  
- **System components**  
  - Frontend: React/Vite + Electron (optional).  
  - Cloud: Supabase Auth + Postgres with RLS.  
  - Offline: LocalBridge (SQLite) + IndexedDB cache.

- **Data models (cloud/Supabase)**  
  - `profiles` (id, full_name, email, avatar_url, created_at, updated_at)  
  - `user_roles` (id, user_id, role, store_id, created_at)  
  - `stores` (id, name, address, phone, owner_id, created_at, updated_at)  
  - `product_families` (id, store_id, name, description, parent_id, created_at, updated_at)  
  - `products` (id, store_id, name, description, sku, barcode, category, unit_price, wholesale_price, cost_price, quantity, min_quantity, image_url, created_at, updated_at)  
  - `sales` (id, store_id, worker_id, sale_type, total_price, payment_method, payment_status, customer_name, customer_phone, created_at, updated_at)  
  - `sale_items` (id, sale_id, product_id, product_name, quantity, unit_price, discount, total, created_at)  
  - `deliveries` (id, sale_id, store_id, deliverer_id, delivery_address, status, scheduled_at, delivered_at, created_at, updated_at)

- **Data models (LocalBridge SQLite)**  
  - `users`, `user_roles`, `sessions`, `stores`, `product_families`, `products`  
  - Mirrors cloud shapes to allow sync parity.

- **Local cache (IndexedDB)**  
  - `inventory`, `sales`, `stores`, `users`, `roles`, `sync_queue`, `session`  
  - Used by offline services for immediate UI updates.

- **Pyramid (hierarchy) designations**  
  - Organization → Store → Role → Catalog (Families → Products) → Inventory → Sales → Deliveries  
  - Master controls top levels; workers operate catalog/sales for assigned stores.

# Item Lifecycle & Placement Rules  
- **Create product**  
  - Online: UI → `products` (Supabase) → update local cache.  
  - Offline: UI → LocalBridge `products` → update IndexedDB → sync queue.

- **Update product**  
  - Update same record (`products` row by `id`).  
  - Refresh master inventory list and worker product list after update.

- **Inventory impact**  
  - Sale reduces `products.quantity`.  
  - Delivery increases `products.quantity`.  
  - All updates must include `store_id` to keep store isolation.

# Development Roadmap  
- **MVP scope**  
  - Role assignment and store setup (master).  
  - Product families + products CRUD.  
  - Sales + sale items.  
  - Deliveries with status updates.  
  - Offline cache and sync queue.

- **Future enhancements**  
  - Audit logs for all stock changes.  
  - Supplier purchase flows and advanced analytics.  
  - Conflict resolution UI for sync.

# Logical Dependency Chain  
1. Auth + roles + store selection.  
2. Catalog (families, products).  
3. Inventory update rules for sales/deliveries.  
4. Offline cache + sync.  
5. Reporting and analytics.

# Risks and Mitigations  
- **RLS denies inserts** → test policies for master/worker and require store_id in all writes.  
- **Offline divergence** → queue writes and rehydrate lists from local cache on reconnect.  
- **Missing inventory updates** → centralize writes in inventory services and update cache on success.

# Appendix  
- Use Supabase migrations as the source of truth for schema parity.  
- LocalBridge must mirror `products` and `product_families` to prevent missing inventory entries.
</PRD>
