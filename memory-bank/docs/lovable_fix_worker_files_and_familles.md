# Prompt: Fix Worker File Creation & Famille-Produits Flows

**Context**: In Pro/retail-manager/frontend the worker dashboard can no longer create "Fichiers → Produits" because Supabase rejects inserts with "Could not find the cost_price column." The schema migration `20260125110000_enhance_products_and_add_product_families.sql` was created but never applied, so local/remote databases are out of sync. At the same time, the "Fichiers → Famille-Produits" module cannot load or save data because the `product_families` table and its RLS policies aren’t available, causing UI errors and empty lists.

**Objective**: Align Supabase schema with the new migration, then verify both worker modules function.

## 1. Supabase Schema Sync
1. Install/launch Docker Desktop (or equivalent) so the Supabase CLI can run locally.
2. From `Pro/retail-manager/frontend` run  
   `npx supabase start` → wait for services, then  
   `npx supabase migration up` to apply `20260125110000_enhance_products_and_add_product_families.sql`.  
   (If targeting the remote project instead, supply the encoded `--db-url`.)
3. Confirm the `products` table now has `cost_price`, `wholesale_price`, `min_quantity`, and any other columns defined in that migration.
4. Confirm the `product_families` table exists with RLS policies referencing `get_user_store_ids()` and indexes on `store_id`.

## 2. Worker “Nouveau Produit” Flow
1. In `src/components/worker/Modules/FichiersProduitsModule.tsx`, create a product with all price fields populated.
2. Ensure the Edge Function (`supabase/functions/create-product/index.ts`) receives/uses `cost_price`, `wholesale_price`, `min_quantity`.
3. Verify the insert succeeds (toast shows success and Supabase row exists). Investigate any remaining validation errors.

## 3. Famille-Produits Module
1. In `src/components/worker/Modules/FichiersFamillesModule.tsx`, ensure it fetches families with `store_id` filters, handles loading/error states, and supports create/update/delete.
2. Confirm Supabase permissions allow `worker` role to manage rows in their store.
3. Test UI end-to-end: create a family, edit it, delete it, reload page to ensure persistence.

## 4. Documentation
Update `memory-bank/docs/worker_inventory_create_items_fix.md` (or new doc) summarizing:
- Migrations applied and required commands.
- Any schema/RLS adjustments.
- Testing steps for both modules.

Deliverables: running migrations output, verified UI behavior (screenshots or notes), and updated documentation.

---

## 5. Legacy RLS Error (blocking QA right now)
- Reproduce: Worker creates a product in "Fichiers → Produits" and sees `new row violates row-level security policy for table "products"`.
- Root Cause: `worker_create_product` RPC + Edge fallback expect the new `worker_create_product` SECURITY DEFINER function (migration `20260125153000_create_worker_insert_product_function.sql`) to exist server-side. Until migrations run, inserts still hit the raw `products` table under worker credentials and RLS blocks them.

### Required Fix
1. Apply the pending migration locally/remote (section 1). Confirm the function exists via `SELECT proname FROM pg_proc WHERE proname = 'worker_create_product';`.
2. Grant `EXECUTE` on the function to `authenticated` (done inside the migration) and verify a worker role can call it by running `select worker_create_product(...)` in SQL Editor using a worker session if available.
3. Re-test product creation flow; it should now return 201 with the inserted row and no longer fire the RLS error toast.

### Extra Validation
- From Supabase SQL editor run `SELECT * FROM pg_policies WHERE tablename = 'products';` to ensure the worker insert policy still references `get_user_store_ids`.
- If any workers continue to fail, confirm they actually have a `user_roles` row tying them to the store_id seen in the payload.
