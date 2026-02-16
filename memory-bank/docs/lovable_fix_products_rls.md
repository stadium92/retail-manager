# Lovable Prompt: Fix Products RLS "new row violates row-level security policy" Error

Copy this entire prompt and paste it into your Lovable chat:

---

## Issue
Users get error: "Erreur - new row violates row-level security policy for table \"products\"" when trying to create new products in Fichiers → Produits section.

## Root Cause
1. The RLS policy for `products` table is missing `WITH CHECK` clause needed for INSERT operations
2. User might not have a `master` role assigned in the database

## Required Fixes

### Fix 1: Apply RLS Policy Migration
The `products` table RLS policies need to be updated. Run this SQL in Supabase SQL Editor:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;
DROP POLICY IF EXISTS "Workers can view store products" ON public.products;
DROP POLICY IF EXISTS "Workers can update store products" ON public.products;
DROP POLICY IF EXISTS "Workers can create products" ON public.products;

-- Masters can do everything
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Workers can view their store products
CREATE POLICY "Workers can view store products"
ON public.products FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Workers can insert in their stores
CREATE POLICY "Workers can insert store products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Workers can update their store products
CREATE POLICY "Workers can update store products"
ON public.products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);
```

### Fix 2: Ensure User Has Master Role
Check if the current user has a master role. Run in Supabase SQL Editor:

```sql
SELECT user_id, role FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master';
```

If no rows returned, assign master role:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'master')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Action Items for Lovable

1. **Verify RLS Policies**: Check Supabase `pg_policies` table to confirm the products table has the correct policies with `WITH CHECK` clauses
2. **Create migration file** (optional, if using migrations): Add migration `20260124100000_complete_products_rls_fix.sql` with the SQL above
3. **Test**: After applying SQL fixes, test product creation in the frontend (Fichiers → Produits)

## Next Steps
1. Go to your Supabase project dashboard
2. Open SQL Editor
3. Copy the SQL fixes above and run them
4. Test product creation in the app again

The error should be resolved after applying these RLS policy fixes.

---
