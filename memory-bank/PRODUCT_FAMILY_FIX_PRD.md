# PRD: Product Family Persistence and Filtering Fix

## 1. Problem Statement
Users reported that updating the "Family" (Category) of a product in the "Products/items" submodule was not persisting. Even after selecting a new family and saving, the product remained in its old category or showed no category. Additionally, the family filter in the product submodule (e.g., filtering for "alcool") was non-functional, showing no results even when products were assigned to that family.

## 2. Root Cause Analysis
The investigation revealed a multi-layered mapping and naming inconsistency across the stack:

### 2.1 Attribute Naming Mismatch
- **Frontend Master Store (`ProductMaster`):** Used `family_id`.
- **Frontend Service & Types (`InventoryItem`):** Used `category_id`.
- **Backend (LocalBridge) & Database (Supabase/SQLite):** Used `category`.

### 2.2 Service Layer Gaps (`OfflineInventoryService.ts`)
- **Supabase Sync:** The `updateItem` function was missing the `category` field in the object sent to Supabase, meaning online updates never reached the cloud.
- **IndexedDB Mapping:** The function `mapLocalInventoryToItem` (used when reading from local storage) failed to map the local `category` field to the frontend's expected `category_id`.

### 2.3 Frontend Logic Errors (`FichiersProduitsModule.tsx`)
- The `useMemo` filter was checking `p.family_id`, but the objects returned by the service (mapped from the DB) contained the data in `p.category_id`.
- The form state management was inconsistent, sometimes using `category_id` and sometimes `family_id`.

## 3. Goals
- Ensure product family updates persist locally and in the cloud.
- Ensure the family filter correctly identifies and displays products assigned to specific categories.
- Standardize the flow of category data between the UI and the persistence layer.

## 4. Implementation Details (Fixed)

### 4.1 Frontend Component (`FichiersProduitsModule.tsx`)
- Standardized the internal component state (`formData`) to use `family_id`.
- Updated the table display and the `filteredProducts` logic to correctly reference `p.family_id`.
- Ensured the `handleSave` payload maps `family_id` to the property expected by the service.

### 4.2 Service Layer (`OfflineInventoryService.ts`)
- **Mapping Fix:** Updated `mapLocalInventoryToItem` to include `category_id: item.category`.
- **Creation Fix:** Updated `createItem` to correctly save the category to IndexedDB.
- **Update Fix:** Added `if (updates.category_id !== undefined) dbUpdates.category = updates.category_id;` to the Supabase update block.
- **Local Persistence Fix:** Ensured the local state object in `updateItem` correctly tracks category changes before writing to IndexedDB.

### 4.3 Backend (LocalBridge)
- Verified that `db.ts` and `routes/products.ts` correctly handle the `category` column in the `products` table.

## 5. Verification Steps
1. Open the "Files" module -> "Products/Items" submodule.
2. Edit a product (e.g., "Vody").
3. Change its family to "alcool" or another category.
4. Save the product.
5. Refresh the page and verify the family name is displayed in the table.
6. Use the Family Filter dropdown at the top and select the new category; the product should appear correctly.

## 6. Path
`MVP/Pro/retail-manager/memory-bank/PRODUCT_FAMILY_FIX_PRD.md`
