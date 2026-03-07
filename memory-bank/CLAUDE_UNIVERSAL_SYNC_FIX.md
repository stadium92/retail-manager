# Ultimate Stabilization Mission: Universal Sync & Data Integrity

**Context:**
We have moved to a 100% Local-First architecture. However, the "Edition" and "Gestion" modules are failing to load data ("failed to load"), and the "Stock" submodules are not reflecting sales in real-time. Sales are also failing with a generic "error" toast.

**Your Objective:**
Act as a Principal Software Engineer to implement "Universal Interception and Reactivity" across the entire codebase. Every module must be secured by our token refresh logic and react instantly to database changes.

---

### 1. Refactor Edition & Gestion (Authorization & Data Mapping)
- **Task:** Refactor `EditionModule.tsx` and `GestionModule.tsx` to use **`OfflineAuthService.localBridgeRequest`**.
- **Data Mapping Fix:** In `EditionModule.tsx` and `OfflineDataService.ts`, the backend returns items in the `.items` field, but some code still looks for `.sale_items`. 
- **Exigence:** Change all logic to use: `const items = (sale.items?.length ? sale.items : sale.sale_items) || [];`. This ensures that even if one field is an empty array, it picks the one containing data.

### 2. Robust Sales Recording
- **Task:** Fix the "error" toast in `SalesModule.tsx`.
- **Exigence:** In `OfflineSalesService.ts`, ensure `createSaleWithItems` sends a payload where every field is explicitly mapped to the backend's expected snake_case format:
  ```typescript
  // Payload for POST /rest/v1/sales
  {
    ...sale,
    items: items.map(item => ({
      id: item.id || crypto.randomUUID(),
      product_id: item.product_id || item.productId || null,
      product_name: item.product_name || item.productName || item.designation || 'Unknown',
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price || item.unitPrice || 0),
      total: Number(item.total || item.lineTotal || 0)
    }))
  }
  ```
- **Constraint:** Ensure `productId` (camelCase) from the frontend is correctly mapped to `product_id` (snake_case). If `product_id` is null, stock deduction will fail!

### 3. Real-Time Stock Reactivity
- **Task:** Update `StockModule.tsx`, `StockListingModule.tsx`, and `ValorisationStock.tsx`.
- **Exigence:** Add `useEffect` listeners for the **`localDbDataUpdated`** event. When a `{ type: 'sale' }` event is detected, trigger the `fetchData` or `refetch` callback immediately.

### 4. Token & Interceptor Stability
- **Task:** Review `OfflineAuthService.ts` and `localBridgeRequest`.
- **Exigence:** Ensure the interceptor correctly pauses on 401, refreshes the token, and **retries the original request**. Ensure the refresh token (which is an opaque string) is not validated as a JWT.

---

**Constraint:**
- Maintain **Persistent Empty Row** and **High-Speed Navigation**.
- Maintain **1-hour session** security.
- Provide a summary of all files touched.
