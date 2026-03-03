# PROMPT: Fix Inventory Module Synchronization (Master & Worker)

## Goal
Fix the persistent synchronization issues where product updates (creation, modification, deletion) fail to propagate between the LocalBridge (SQLite), Frontend (IndexedDB), and Supabase (Cloud).

## Technical Requirements

### 1. Unified Sync Authority (Frontend)
Refactor `frontend/src/services/OfflineInventoryService.ts`:
*   Identify `createItem`, `updateItem`, and `deleteItem`.
*   Ensure that when `isLocalFirst` is true (Tauri/Bridge mode), the service **ONLY** calls the LocalBridge API and the `LocalDatabase` (IndexedDB). 
*   **CRITICAL**: Disable the direct call to `SyncService.addToQueue` for inventory items in `isLocalFirst` mode. The LocalBridge will handle the sync to the cloud via its own outbox system.

### 2. Complete Field Mapping (Frontend)
Update `frontend/src/services/SyncService.ts`:
*   Locate `syncInventoryUpdate`.
*   Expand the `upsert` payload to include **ALL** newly added price tiers and logistics fields:
    *   `selling_price_2`, `selling_price_3`, `selling_price_4`
    *   `wholesale_price_ht`, `wholesale_price_ttc`
    *   `reorder_quantity`, `unit_type`, `packaging`, `aisle`, `brand`
*   Ensure the values are correctly cast to numbers or null as expected by the Supabase schema.

### 3. Backend Outbox Hardening (Backend)
Update `backend/local-bridge/src/db/repositories/products.repo.ts`:
*   In `insertProduct` and `updateProduct`, ensure the `emitOutbox` call receives the full product object with all new fields.
*   Verify that `sanitizeString` is applied to all text fields before emitting to the outbox.

### 4. Database Schema Verification
*   Verify `backend/local-bridge/src/db/schema.ts` to ensure the `products` table matches the expected columns.
*   Note: The user recently removed `sub_packaging`, so ensure no references to it remain.

## Relevant Files for Context
1. `frontend/src/services/OfflineInventoryService.ts` (Data orchestrator)
2. `frontend/src/services/SyncService.ts` (Frontend cloud sync)
3. `backend/local-bridge/src/db/repositories/products.repo.ts` (Backend database logic)
4. `frontend/src/services/LocalDatabase.ts` (IndexedDB schema)
5. `backend/local-bridge/src/db/schema.ts` (SQLite schema)
