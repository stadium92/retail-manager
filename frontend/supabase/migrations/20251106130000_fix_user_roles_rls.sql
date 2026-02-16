-- Fix user_roles RLS Policies
-- This migration fixes the RLS policy conflicts that prevent role assignment

-- Step 1: Drop all existing INSERT policies on user_roles to start fresh
DROP POLICY IF EXISTS "Masters can insert roles in their stores" ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;

-- Step 2: Create a comprehensive SELECT policy that allows:
-- - Users to view their own roles (with or without store_id)
-- - Users to view roles in stores they have access to
-- - Masters to view all roles in their stores
DROP POLICY IF EXISTS "Users can view roles in their stores" ON public.user_roles;
CREATE POLICY "Users can view their own roles and store roles"
ON public.user_roles FOR SELECT
USING (
  -- Users can view their own roles (including global roles with store_id IS NULL)
  user_id = auth.uid()
  OR
  -- Users can view roles in stores they have access to
  (
    store_id IS NOT NULL AND
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
  OR
  -- Masters can view all roles in their stores
  (
    public.has_role(auth.uid(), 'master') AND
    (
      store_id IS NULL OR
      store_id IN (SELECT public.get_user_stores(auth.uid()))
    )
  )
);

-- Step 3: Create INSERT policy that allows:
-- - Trigger functions (SECURITY DEFINER) to insert during signup (bypasses RLS, but policy should allow)
-- - Users to insert their own role during signup (without store_id)
-- - Masters to insert roles for others (with store_id)
CREATE POLICY "Allow role assignment on signup and by masters"
ON public.user_roles FOR INSERT
WITH CHECK (
  -- Allow users to insert their own role during signup (store_id can be NULL)
  (
    user_id = auth.uid() AND
    store_id IS NULL AND
    -- Only allow if user doesn't already have this role (prevent duplicates)
    NOT EXISTS (
      SELECT 1
      FROM public.user_roles existing_roles
      WHERE existing_roles.user_id = auth.uid()
        AND existing_roles.role = role
        AND existing_roles.store_id IS NULL
    )
  )
  OR
  -- Allow masters to insert roles for others (with store_id)
  (
    public.has_role(auth.uid(), 'master') AND
    (
      store_id IS NULL OR
      store_id IN (SELECT public.get_user_stores(auth.uid()))
    )
  )
);

-- Step 4: Update UPDATE policy to allow masters to update roles
DROP POLICY IF EXISTS "Masters can update roles" ON public.user_roles;
CREATE POLICY "Masters can update roles in their stores"
ON public.user_roles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

-- Step 5: Ensure DELETE policy allows masters to delete roles
DROP POLICY IF EXISTS "Masters can delete roles in their stores" ON public.user_roles;
CREATE POLICY "Masters can delete roles in their stores"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'master') AND
  (
    store_id IS NULL OR
    store_id IN (SELECT public.get_user_stores(auth.uid()))
  )
);

-- Step 6: Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Step 7: Ensure the trigger function can bypass RLS by using SECURITY DEFINER
-- The trigger function should already be SECURITY DEFINER, but let's verify and update if needed
CREATE OR REPLACE FUNCTION public.auto_assign_role_on_profile_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  assigned_role public.app_role;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;
  
  -- Assign role based on email (server-side)
  assigned_role := public.assign_role_from_email(NEW.id, user_email);
  
  -- Insert role assignment (SECURITY DEFINER should bypass RLS, but policy should allow)
  -- Use store_id = NULL for global roles during signup
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (NEW.id, assigned_role, NULL)
  ON CONFLICT (user_id, role, store_id) DO NOTHING; -- Prevent duplicate role assignments
  
  RETURN NEW;
END;
$$;

-- Step 8: Also ensure the auth.users trigger function can insert roles
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function assigns a default 'master' role, but the email-based trigger should override
  -- We'll keep this as a fallback, but the profile trigger should handle role assignment
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (NEW.id, 'customer'::public.app_role, NULL)
  ON CONFLICT (user_id, role, store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Step 9: Add a comment explaining the RLS policy structure
COMMENT ON POLICY "Allow role assignment on signup and by masters" ON public.user_roles IS 
'Allows users to insert their own role during signup (store_id NULL) and masters to insert roles for others. SECURITY DEFINER functions bypass RLS, but this policy ensures client-side inserts work correctly.';

-- Step 10: Create a helper function for masters to assign roles (with proper RLS)
-- This function already exists, but let's ensure it's correct
CREATE OR REPLACE FUNCTION public.assign_role_manually(
  _user_id UUID,
  _role public.app_role,
  _store_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Check if current user is master
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Only masters can manually assign roles';
  END IF;
  
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = _user_id;
  
  -- Insert or update role (SECURITY DEFINER bypasses RLS, but we check permissions above)
  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (_user_id, _role, _store_id)
  ON CONFLICT (user_id, role, store_id) DO UPDATE
  SET role = _role;
  
  -- Log the manual assignment
  INSERT INTO public.role_audit_log (
    user_id,
    assigned_role,
    assigned_by,
    assignment_method,
    email
  )
  VALUES (
    _user_id,
    _role,
    auth.uid(),
    'manual',
    user_email
  )
  ON CONFLICT DO NOTHING;
  
  RETURN TRUE;
END;
$$;




