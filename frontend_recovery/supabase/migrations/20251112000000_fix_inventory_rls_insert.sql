-- Fix inventory RLS policy to allow INSERT operations
-- The current policy only has USING clause, which doesn't apply to INSERT
-- We need to add WITH CHECK clause for INSERT operations

-- Drop the existing policy
DROP POLICY IF EXISTS "Masters can manage inventory" ON public.inventory;

-- Recreate the policy with both USING and WITH CHECK clauses
-- Masters can do ALL operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Masters can manage inventory"
ON public.inventory FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- Allow workers to INSERT inventory items in their assigned stores
-- Workers can create new items but cannot update or delete them
CREATE POLICY "Workers can create inventory items"
ON public.inventory FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'worker') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

