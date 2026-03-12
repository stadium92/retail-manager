# Prompt: Implement Offline-First Architecture for Admin Modules

**Context**: The application works offline for POS (Sales), but the Admin modules (Edition, Gestion, Stock) are hard-coded to fetch from Supabase, causing them to hang or fail when offline. The user's device may have little to no internet connection.

**Objective**: Refactor these modules to read from the local `IndexedDB` (via `LocalDatabase.ts`) and Zustand stores (`useMasterDataStore.ts`) instead of direct Supabase calls. Ensure "Logout" works offline.

## 1. Refactor Data Access Pattern
Stop importing `supabase` directly in components for reading data. Instead:
- **Products/Clients/Suppliers**: Use `useMasterDataStore`.
- **Sales/History**: Use `LocalDatabase` or a new `useSalesStore` that wraps `LocalDatabase.getSales()`.
- **Stock Movements**: Since we don't sync full history yet, update `LocalDatabase` to store a local cache of movements or generate them from local sales/purchases. For now, graceful degradation: "Historique disponible uniquement en ligne" if offline, or build a simple local log.

## 2. Component Updates

### A. Edition Module (`EditionModule.tsx`)
- **Source**: Replace `supabase.from('sales')` with `LocalDatabase.getSales(storeId)`.
- **Filtering**: Perform date range and string filtering in JavaScript on the client side (since IndexedDB queries are basic).
- **Suppliers**: Use `useMasterDataStore().suppliers`.

### B. Gestion Module (`GestionModule.tsx`)
- **Dashboard**: Calculate KPIs (Revenue, Profit) by iterating over the local sales array from `LocalDatabase`.
- **Cash Journal**: Aggregate local sales and expenses.

### C. Stock Module (`StockModule.tsx`)
- **Products**: Use `useMasterDataStore().products`.
- **Inventory**: Use `LocalDatabase.getInventory()` or fallback to Product Master data.
- **Movements**:
    - If `useMasterDataStore` doesn't track movements -> Create a `promisified` function to fetch from `LocalDatabase` if we decide to store movements there.
    - **Stub**: If no local movements exist, show empty list with "Synchronisation requise pour l'historique".

## 3. Offline Logout
- **File**: `WorkerStatusBar.tsx` (or where logout is handled).
- **Action**: Replace `supabase.auth.signOut()` with `OfflineAuthService.signOut()`.
- **Logic**: This function (already implemented) clears the local session but preserves unsynced queue items.

## 4. Sync Mechanism (Verification)
- Ensure `SyncService` or `OfflineSalesService` actually *fetches* data from Supabase into `LocalDatabase` when the app *is* online (Initial Sync).
- If "Initial Sync" logic is missing, add a feature "Synchroniser les données" in the Settings/Program module that fetches full history from Supabase and populates `LocalDatabase`. (Critical for the "Offline from now on" use case).

**Deliverables**:
- Updated `EditionModule.tsx`, `GestionModule.tsx`, `StockModule.tsx`.
- Updated `WorkerStatusBar.tsx`.
- (Optional) New `InitialSync` logic in `SettingsModule`.
