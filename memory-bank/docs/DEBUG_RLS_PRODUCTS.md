# Debug: Check Current RLS State in Supabase

Run each of these queries in your Supabase SQL Editor to diagnose the issue:

## 1. Check if you have a master role assigned:

```sql
SELECT user_id, role, store_id 
FROM public.user_roles 
WHERE user_id = auth.uid();
```

**Expected**: At least one row with `role = 'master'` and `store_id = NULL`

If empty: **THIS IS THE PROBLEM** - you have no role assigned. Run:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES (auth.uid(), 'master')
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## 2. Check all policies on products table:

```sql
SELECT schemaname, tablename, policyname, permissive, qual, with_check
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY policyname;
```

**Expected**: Should see 4 policies:
- `Masters can manage products` (should have both USING and WITH CHECK)
- `Workers can view store products`
- `Workers can insert store products`
- `Workers can update store products`

**If missing WITH CHECK**: Run the migration from `20260124100000_complete_products_rls_fix.sql`

---

## 3. Check available stores:

```sql
SELECT id, name, owner_id 
FROM public.stores 
LIMIT 5;
```

If empty: You need to create a store first

---

## 4. Test INSERT permission (diagnostic):

```sql
-- This will tell you why the INSERT is failing
INSERT INTO public.products (
  store_id,
  name,
  description,
  sku,
  unit_price,
  quantity
) VALUES (
  (SELECT id FROM public.stores LIMIT 1),  -- Use first store
  'Test Product',
  'Test Description',
  'TEST-SKU',
  100.00,
  10
)
RETURNING id, name;
```

If this fails, note the error message - it will tell you which RLS policy is blocking it.

---

## 5. If still blocked, check the exact error:

Look at the Supabase logs:
1. Go to **Logs** (left sidebar)
2. Filter by your recent queries
3. Look for detailed error messages about which policy is blocking the INSERT

---

## Apply the complete fix:

Copy all SQL from `20260124100000_complete_products_rls_fix.sql` and run it in SQL Editor.
