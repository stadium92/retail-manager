# Products RLS Fix - Direct SQL (For Supabase Dashboard)

**ERROR**: `new row violates row-level security policy for table "products"`

## Root Cause

The original `"Masters can manage products"` RLS policy is missing `WITH CHECK` clause needed for INSERT operations.

## QUICK FIX - Copy and paste this into Supabase SQL Editor:

```sql
-- Drop the problematic policy
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;

-- Recreate with WITH CHECK to allow inserts
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
)
WITH CHECK (
  public.has_role(auth.uid(), 'master')
);

-- Also ensure workers can insert in their stores
DROP POLICY IF EXISTS "Workers can create products" ON public.products;
CREATE POLICY "Workers can create products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
  );
```

## Steps:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Paste the SQL above
6. Click **Run** (or ⌘+Enter)
7. Verify: "Success" message appears

## Test:

After applying, try creating a product in the app again.

If still blocked, check:
- Is the user actually a "master" in `user_roles` table?
  - Go to **Database** > **user_roles** and verify the user has `role='master'`
- If role is missing, run:
  ```sql
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'master')
  ON CONFLICT DO NOTHING;
  ```

