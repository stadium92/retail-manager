-- Fix: Allow masters to read profiles of all users in their store
-- This RLS policy lets a master user see profiles of workers/deliverers in their restaurants

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Masters can read all profiles in their store" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;

-- Create a unified SELECT policy that allows:
-- 1. Any user to view their own profile
-- 2. Masters to view profiles of all users in their store(s)
CREATE POLICY "profiles_select_policy"
ON profiles FOR SELECT
USING (
  id = auth.uid()
  OR
  id IN (
    SELECT ur.user_id FROM user_roles ur
    WHERE ur.store_id IN (
      SELECT store_id FROM user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    )
  )
);
