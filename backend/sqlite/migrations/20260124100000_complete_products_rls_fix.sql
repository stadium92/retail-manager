-- Auto-generated from 20260124100000_complete_products_rls_fix.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- COMPREHENSIVE FIX: Products RLS and Role Assignment
-- This migration ensures proper RLS policies AND verifies user roles exist

-- Step 1: Fix products table RLS policies (the core issue)
-- Drop all old policies
DROP POLICY IF EXISTS "Masters can manage products" ON products;
DROP POLICY IF EXISTS "Workers can view store products" ON products;
DROP POLICY IF EXISTS "Workers can update store products" ON products;
DROP POLICY IF EXISTS "Workers can create products" ON products;

-- Step 2: Recreate ALL policies with proper WITH CHECK clauses for INSERT/UPDATE/DELETE

-- Masters can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Masters can manage products"
ON products
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'))
WITH CHECK (has_role(auth.uid(), 'master'));

-- Workers can SELECT products from their assigned stores
CREATE POLICY "Workers can view store products"
ON products
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- Workers can INSERT products in their assigned stores
CREATE POLICY "Workers can insert store products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- Workers can UPDATE products in their assigned stores
CREATE POLICY "Workers can update store products"
ON products
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- Step 3: Ensure first user (creator/owner) has master role assigned
-- This fixes the "user exists but has no role" issue
DO $$
DECLARE
  first_user_id TEXT;
BEGIN
  -- Get the first created user
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Ensure this user has the master role
    INSERT INTO user_roles (user_id, role)
    VALUES (first_user_id, 'master')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Step 4: Debug info - show all policies on products table
-- Run this in SQL Editor to verify:
-- SELECT * FROM pg_policies WHERE tablename = 'products';

-- Step 5: Verification checklist:
-- 1. SELECT * FROM user_roles WHERE role = 'master' LIMIT 5;
--    ^ Should show at least one master user
-- 2. SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products';
--    ^ Should show 4 policies
-- 3. Try INSERT again from frontend
