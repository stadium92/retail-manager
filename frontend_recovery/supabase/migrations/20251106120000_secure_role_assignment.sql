-- Secure Role Assignment Migration
-- This migration implements server-side role assignment with proper security

-- Step 1: Create function to assign role based on email (server-side)
CREATE OR REPLACE FUNCTION public.assign_role_from_email(_user_id UUID, _email TEXT)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
  -- Server-side email patterns (not exposed to client)
  master_patterns TEXT[] := ARRAY['%@master.%', 'master@%', '%@admin.%', 'admin@%', '%@owner.%', 'owner@%'];
  worker_patterns TEXT[] := ARRAY['%@worker.%', 'worker@%', '%@employee.%', 'employee@%'];
  deliverer_patterns TEXT[] := ARRAY['%@deliverer.%', 'deliverer@%', '%@delivery.%', 'delivery@%'];
  pattern TEXT;
BEGIN
  -- Normalize email
  _email := LOWER(TRIM(_email));
  
  -- Check master patterns
  FOREACH pattern IN ARRAY master_patterns
  LOOP
    IF _email LIKE pattern THEN
      assigned_role := 'master';
      RETURN assigned_role;
    END IF;
  END LOOP;
  
  -- Check worker patterns
  FOREACH pattern IN ARRAY worker_patterns
  LOOP
    IF _email LIKE pattern THEN
      assigned_role := 'worker';
      RETURN assigned_role;
    END IF;
  END LOOP;
  
  -- Check deliverer patterns
  FOREACH pattern IN ARRAY deliverer_patterns
  LOOP
    IF _email LIKE pattern THEN
      assigned_role := 'deliverer';
      RETURN assigned_role;
    END IF;
  END LOOP;
  
  -- Default to customer
  assigned_role := 'customer';
  RETURN assigned_role;
END;
$$;

-- Step 2: Create trigger function for automatic role assignment on signup
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
  
  -- Insert role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING; -- Prevent duplicate role assignments
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on profile creation
DROP TRIGGER IF EXISTS auto_assign_role_trigger ON public.profiles;
CREATE TRIGGER auto_assign_role_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_role_on_profile_create();

-- Step 4: Update RLS policy to allow role assignment during signup
DROP POLICY IF EXISTS "Users can insert their own role on signup" ON public.user_roles;
CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  -- Only allow if user doesn't already have a role (prevent duplicates)
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  )
);

-- Step 5: Create audit log table for role assignments
CREATE TABLE IF NOT EXISTS public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_role public.app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assignment_method TEXT NOT NULL, -- 'signup', 'manual', 'trigger', 'admin'
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only masters can view audit logs
CREATE POLICY "Masters can view audit logs"
ON public.role_audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'master'));

-- Step 6: Create function to log role assignments
CREATE OR REPLACE FUNCTION public.log_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;
  
  -- Log the role assignment
  INSERT INTO public.role_audit_log (
    user_id,
    assigned_role,
    assigned_by,
    assignment_method,
    email
  )
  VALUES (
    NEW.user_id,
    NEW.role,
    COALESCE(auth.uid(), NEW.user_id), -- Use current user or self if no auth context
    'signup',
    user_email
  );
  
  RETURN NEW;
END;
$$;

-- Step 7: Create trigger to log role assignments
DROP TRIGGER IF EXISTS log_role_assignment_trigger ON public.user_roles;
CREATE TRIGGER log_role_assignment_trigger
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_assignment();

-- Step 8: Create function for masters to manually assign roles (with audit)
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
  
  -- Insert or update role
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
  );
  
  RETURN TRUE;
END;
$$;

-- Step 9: Grant execute permission to authenticated users (masters only via RLS)
GRANT EXECUTE ON FUNCTION public.assign_role_manually TO authenticated;

-- Step 10: Create index on audit log for performance
CREATE INDEX IF NOT EXISTS idx_role_audit_log_user_id ON public.role_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_created_at ON public.role_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_role_audit_log_role ON public.role_audit_log(assigned_role);

