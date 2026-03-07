# Ultimate Mission: Full System Stabilization & Security Hardening

**Context:**
We have transitioned to a 100% Local-First architecture. While we have implemented several fixes locally, the codebase still has inconsistent patterns that cause "10-minute freezes" (token expiration) and "Ghost Files" (cache mismatch). Currently, sales are failing with a generic "error" toast message.

**Your Objective:**
Act as a Senior Principal Engineer to apply the following three critical stabilization patterns across the ENTIRE codebase (Frontend and Backend). You must go through every repository, service, and route file to ensure 100% consistency.

---

### 1. Token Security & Proactive Refresh (The "Heartbeat")
The app uses a 15-minute Access Token for security. We must keep this but make it bulletproof.
- **Heartbeat:** Implement a background timer in `AuthContext` that proactively refreshes the session token every 10 minutes (5 minutes before expiry).
- **Atomic Lock:** Update `TokenManager.ts` to use a `localStorage` based lock. If 3 tabs are open, only ONE tab should perform the refresh; the others must wait and use the new token once it's saved.
- **Request Interceptor (The Escort):** Wrap every backend call (`smartFetch` or `localBridgeRequest`). If a call returns a `401 Unauthorized`, the logic MUST:
    1. Pause execution.
    2. Attempt a silent token refresh using the Refresh Token.
    3. **Retry the original request** automatically with the new token.
    4. ONLY if refresh fails, then clear the session.

### 2. Schema Consistency (Price Tiers & Thresholds)
Ensure every database interaction (Frontend & Backend) supports the full set of price tiers and stock thresholds.
- **Zod Schemas:** Ensure `productCreateSchema`, `productUpdateSchema`, and `workerCreateSchema` in the backend routes (especially `products.ts`) include:
  ```typescript
  cost_price: z.number().nullable().optional(),
  unit_price: z.number().optional(),
  wholesale_price: z.number().nullable().optional(),
  wholesale_price_ht: z.number().nullable().optional(),
  wholesale_price_ttc: z.number().nullable().optional(),
  selling_price_2: z.number().nullable().optional(),
  selling_price_3: z.number().nullable().optional(),
  selling_price_4: z.number().nullable().optional(),
  min_quantity: z.number().optional(),
  low_stock_threshold: z.number().optional(),
  ```
- **Repositories:** Update `products.repo.ts` and `sales.repo.ts` to explicitly handle these fields in `INSERT` and `UPDATE` statements using `ON CONFLICT(id) DO UPDATE`.
- **Mapping:** Update `OfflineInventoryService.ts` and `OfflineSalesService.ts` mapping helpers to ensure these fields are never lost during conversion between DB and Frontend.

### 3. Logic Cleanup & Fixes
- **Ghost Files:** Completely disable "Additive Merging" with IndexedDB. The Local Bridge (SQLite) is the **absolute master source of truth**. If an item is not in SQLite, it must not appear in the UI.
- **Sales Fix:** Resolve the generic "error" when making payments. Check that `OfflineSalesService` uses the correct backend endpoint (`POST /rest/v1/sales`) and that the payload structure matches the backend's expectations (items inside the sale object, using snake_case `unit_price`).
- **Family Deletion:** Ensure `localBridgeRequest` only adds `Content-Type: application/json` headers if a `body` is present. Fix the backend deletion order: unlink products from a family BEFORE deleting the family to avoid Foreign Key errors.

---

**Constraint:**
- Maintain the **Persistent Empty Row** feature in the sales grid.
- Keep the **High-Speed Navigation** (Enter jumps to Quantity, Up/Down adjusts values).
- **DO NOT** revert to Supabase code. Stay on the Local-First path.

Please provide a summary of every file modified and the specific logic applied to each.
