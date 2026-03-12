-- Auto-generated from 20251112000000_fix_inventory_rls_insert.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Fix inventory RLS policy to allow INSERT operations
-- The current policy only has USING clause, which doesn't apply to INSERT
-- We need to add WITH CHECK clause for INSERT operations

-- Drop the existing policy
DROP POLICY IF EXISTS "Masters can manage inventory" ON inventory;

-- Recreate the policy with both USING and WITH CHECK clauses
-- Masters can do ALL operations (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Masters can manage inventory"
ON inventory FOR ALL
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- Allow workers to INSERT inventory items in their assigned stores
-- Workers can create new items but cannot update or delete them
CREATE POLICY "Workers can create inventory items"
ON inventory FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'worker') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);
