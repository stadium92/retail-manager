# Worker Inventory Item Creation Fix (2026-01-25)

## Context
- Workers reported that adding products from the Fichiers ➝ Produits module consistently failed because direct `products` inserts run under the worker session kept hitting the restrictive RLS policies.
- The worker form also captures wholesale pricing, but the serverless `create-product` function ignored that field, so even successful service-role inserts would have lost data.

## Changes
1. [frontend/src/components/worker/Modules/FichiersProduitsModule.tsx](frontend/src/components/worker/Modules/FichiersProduitsModule.tsx)
   - Added a guarded `createProductWithEdgeFallback` helper that first invokes the `create-product` Edge Function (service role) and only falls back to a direct `supabase.from('products').insert` if the function is unavailable.
   - Trimmed inputs, enforced store selection, surfaced in-flight state on the primary action, and ensured we keep the dialog open when Supabase returns an error so users can fix the form.
2. [frontend/supabase/functions/create-product/index.ts](frontend/supabase/functions/create-product/index.ts)
   - Extended the request payload to accept `wholesale_price` and persist it when inserting products so the worker UI keeps wholesale figures in sync with the database.

## Follow-up / Notes
- Consider reusing the same helper (or InventoryService) inside the master inventory experience so both dashboards share the same creation pathway.
- If workers still see RLS errors after this change, verify their `user_roles` rows (role + store_id) and re-run the latest products RLS migrations.
