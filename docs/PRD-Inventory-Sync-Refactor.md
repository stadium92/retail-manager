# PRD: Robust Inventory Synchronization Architecture

## 1. Objective
To resolve persistent synchronization issues in the "Inventory" module across both Master and Worker dashboards. The goal is to ensure that every product creation, modification, and deletion is reliably propagated between the LocalBridge (SQLite), LocalDatabase (IndexedDB), and Supabase (Cloud).

## 2. Current Problem Analysis
The current system suffers from "Double-Queueing" and "Field Mismatch":
1.  **Double-Queueing Conflict**: 
    *   In Local-First mode, `OfflineInventoryService` saves to IndexedDB and then hits the LocalBridge API.
    *   The LocalBridge API saves to SQLite and adds an entry to the `sync_outbox` table.
    *   **Simultaneously**, `OfflineInventoryService` calls `SyncService.addToQueue` in the frontend, which tries to push directly to Supabase.
    *   This creates race conditions, duplicate API calls, and potential "Out of Sync" states where the Cloud has newer data than the LocalBridge or vice-versa.
2.  **Field Mapping Gaps**: 
    *   The `SyncService.syncInventoryUpdate` method in the frontend is missing several critical fields: `selling_price_2`, `selling_price_3`, `selling_price_4`, `wholesale_price_ht`, `wholesale_price_ttc`, and `reorder_quantity`.
    *   When a sync occurs, these values are lost in the cloud.
3.  **Inconsistent Source of Truth**:
    *   Worker dashboards pull from the Bridge, but Master dashboards sometimes pull from Supabase. If the sync lags or fails, they see different data.

## 3. Proposed Solution: Single-Channel Sync
We must establish a clear "Sync Authority" based on the application mode.

### 3.1 Local-First Mode (Worker / Offline-Ready)
*   **Frontend**: Responsible *only* for saving to IndexedDB and calling the LocalBridge API. It should **NOT** call `SyncService.addToQueue` for inventory.
*   **Backend (LocalBridge)**: Responsible for the "Heavy Lifting". It saves to SQLite and manages the `sync_outbox`.
*   **Sync Logic**: The LocalBridge should handle the background synchronization to Supabase. This ensures that the local SQLite and the remote PostgreSQL stay perfectly aligned.

### 3.2 Cloud-Only Mode (Master / Standard Web)
*   **Frontend**: Responsible for direct Supabase mutations and optional IndexedDB caching.

### 3.3 Hardened Mapping
*   Update all sync mappers (Frontend `SyncService` and Backend `emitOutbox` logic) to include **ALL** 15+ product fields, ensuring no data loss during transit.

## 4. Implementation Steps

### Phase 1: Unified Payload Specification
*   Define a `FullProductPayload` type that includes all price tiers and logistics fields.
*   Update `products.repo.ts` to ensure `emitOutbox` receives the complete object.

### Phase 2: Frontend Sync De-duplication
*   Modify `OfflineInventoryService.ts` to skip `SyncService.addToQueue` if `isLocalFirst` is true (since the Bridge will handle it).

### Phase 3: Supabase Schema Alignment
*   Ensure the `products` table in Supabase has columns matching the new price tiers (`selling_price_2`, etc.).

### Phase 4: Validation
*   Perform a "Full Loop" test: Create a product on a Worker dashboard -> Verify in LocalBridge -> Verify in Supabase -> Verify in Master Dashboard.
