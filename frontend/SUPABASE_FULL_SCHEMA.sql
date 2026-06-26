-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('master', 'worker', 'deliverer', 'customer');

-- Create enum for delivery status
CREATE TYPE public.delivery_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');

-- Create enum for sales status
CREATE TYPE public.sales_status AS ENUM ('good', 'bad', 'worse');

-- Create stores table
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table (extends auth.users with role and store info)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role, store_id)
);

-- Create categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost DECIMAL(10, 2) DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    worker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create deliverers table
CREATE TABLE public.deliverers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    vehicle_type TEXT,
    vehicle_number TEXT,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create deliveries table
CREATE TABLE public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    deliverer_id UUID REFERENCES public.deliverers(id) ON DELETE SET NULL,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status public.delivery_status NOT NULL DEFAULT 'pending',
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's stores
CREATE OR REPLACE FUNCTION public.get_user_stores(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT store_id
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- RLS Policies for stores
CREATE POLICY "Users can view their own stores"
ON public.stores FOR SELECT
USING (owner_id = auth.uid() OR id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can insert stores"
ON public.stores FOR INSERT
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can update their stores"
ON public.stores FOR UPDATE
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can delete their stores"
ON public.stores FOR DELETE
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'master'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their stores"
ON public.user_roles FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can insert roles in their stores"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can delete roles in their stores"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their stores"
ON public.categories FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage categories"
ON public.categories FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- RLS Policies for inventory
CREATE POLICY "Users can view inventory in their stores"
ON public.inventory FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage inventory"
ON public.inventory FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- RLS Policies for sales
CREATE POLICY "Users can view sales in their stores"
ON public.sales FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters and workers can create sales"
ON public.sales FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'worker')) AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can update sales"
ON public.sales FOR UPDATE
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can delete sales"
ON public.sales FOR DELETE
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- RLS Policies for deliverers
CREATE POLICY "Users can view deliverers in their stores"
ON public.deliverers FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage deliverers"
ON public.deliverers FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- RLS Policies for deliveries
CREATE POLICY "Users can view deliveries in their stores"
ON public.deliveries FOR SELECT
USING (store_id IN (SELECT public.get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage deliveries"
ON public.deliveries FOR ALL
USING (
  public.has_role(auth.uid(), 'master') AND
  store_id IN (SELECT public.get_user_stores(auth.uid()))
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliverers_updated_at BEFORE UPDATE ON public.deliverers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_stores_owner_id ON public.stores(owner_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_store_id ON public.user_roles(store_id);
CREATE INDEX idx_categories_store_id ON public.categories(store_id);
CREATE INDEX idx_inventory_store_id ON public.inventory(store_id);
CREATE INDEX idx_inventory_category_id ON public.inventory(category_id);
CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_worker_id ON public.sales(worker_id);
CREATE INDEX idx_sales_sale_date ON public.sales(sale_date);
CREATE INDEX idx_deliverers_store_id ON public.deliverers(store_id);
CREATE INDEX idx_deliveries_store_id ON public.deliveries(store_id);
CREATE INDEX idx_deliveries_deliverer_id ON public.deliveries(deliverer_id);
CREATE INDEX idx_deliveries_status ON public.deliveries(status);-- Create trigger to assign default 'master' role on user creation
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Assign a global master role to every new user
  insert into public.user_roles (user_id, role)
  values (new.id, 'master'::app_role)
  on conflict do nothing;
  return new;
end;
$$;

-- Trigger on auth.users to assign role after signup
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute procedure public.handle_new_user_role();

-- Adjust restrictive SELECT policy to allow users to view their own global roles (store_id IS NULL)
drop policy if exists "Users can view roles in their stores" on public.user_roles;
create policy "Users can view roles in their stores"
  on public.user_roles
  as restrictive
  for select
  to authenticated
  using (
    (store_id in (select get_user_stores(auth.uid())))
    or (user_id = auth.uid() and store_id is null)
  );-- Fix linter: set explicit search_path format and keep role trigger
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'master'::app_role)
  on conflict do nothing;
  return new;
end;
$$;

-- Backfill: ensure existing users without roles get a global master role
insert into public.user_roles (user_id, role)
select u.id, 'master'::app_role
from auth.users u
where not exists (
  select 1 from public.user_roles r where r.user_id = u.id
)
on conflict do nothing;-- Secure Role Assignment Migration
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

-- Drop the problematic trigger that auto-assigns master role to all users
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create a new smarter function that only assigns master role for self-signups
-- (when the user signs up directly, not when created by admin API)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-assign master role if the user signed up directly (no created_by metadata)
  -- Users created via admin API will have their role assigned by the edge function
  IF NOT EXISTS (
    SELECT 1 FROM new.raw_user_meta_data WHERE new.raw_user_meta_data->>'created_by' IS NOT NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

-- Recreate the trigger with the updated function
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_role();

-- Clean up duplicate master roles for users who should only be workers
-- Delete the auto-created master roles for users who have a worker role with a store_id
DELETE FROM public.user_roles 
WHERE role = 'master' 
AND store_id IS NULL 
AND user_id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'worker' AND store_id IS NOT NULL
);-- Create role enum (if it doesn't already exist from earlier migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('master', 'worker', 'deliverer', 'customer');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  store_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for store_id in user_roles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_store_id_fkey'
      AND table_name = 'user_roles'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_store_id_fkey 
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  category TEXT,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES auth.users(id),
  customer_name TEXT,
  customer_phone TEXT,
  sale_type TEXT NOT NULL DEFAULT 'detail' CHECK (sale_type IN ('detail', 'gros', 'proforma')),
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
  notes TEXT,
  invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id),
  store_id UUID REFERENCES public.stores(id),
  deliverer_id UUID REFERENCES auth.users(id),
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  invited_by UUID REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_invitations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's store IDs
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.user_roles
  WHERE user_id = _user_id AND store_id IS NOT NULL
  UNION
  SELECT id FROM public.stores WHERE owner_id = _user_id
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Allow insert for new users" ON public.profiles;
CREATE POLICY "Allow insert for new users" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Masters can view all profiles" ON public.profiles;
CREATE POLICY "Masters can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- User Roles RLS Policies (simple, non-recursive)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Masters can view all roles" ON public.user_roles;
CREATE POLICY "Masters can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can insert roles" ON public.user_roles;
CREATE POLICY "Masters can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can update roles" ON public.user_roles;
CREATE POLICY "Masters can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can delete roles" ON public.user_roles;
CREATE POLICY "Masters can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- Stores RLS Policies
DROP POLICY IF EXISTS "Masters can manage stores" ON public.stores;
CREATE POLICY "Masters can manage stores" ON public.stores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view assigned stores" ON public.stores;
CREATE POLICY "Workers can view assigned stores" ON public.stores
  FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_store_ids(auth.uid())));

-- Products RLS Policies
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
)
WITH CHECK (
  public.has_role(auth.uid(), 'master')
);

DROP POLICY IF EXISTS "Workers can view store products" ON public.products;
CREATE POLICY "Workers can view store products" ON public.products
  FOR SELECT TO authenticated USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Workers can update store products" ON public.products;
CREATE POLICY "Workers can update store products" ON public.products
  FOR UPDATE TO authenticated USING (
    store_id IN (SELECT public.get_user_store_ids(auth.uid()))
    AND public.has_role(auth.uid(), 'worker')
  );

DROP POLICY IF EXISTS "Workers can create products" ON public.products;
CREATE POLICY "Workers can create products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
  );

-- Sales RLS Policies
DROP POLICY IF EXISTS "Masters can manage sales" ON public.sales;
CREATE POLICY "Masters can manage sales" ON public.sales
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can create sales" ON public.sales;
CREATE POLICY "Workers can create sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Workers can view store sales" ON public.sales;
CREATE POLICY "Workers can view store sales" ON public.sales
  FOR SELECT TO authenticated USING (store_id IN (SELECT public.get_user_store_ids(auth.uid())));

-- Sale Items RLS Policies
DROP POLICY IF EXISTS "Users can view sale items for accessible sales" ON public.sale_items;
CREATE POLICY "Users can view sale items for accessible sales" ON public.sale_items
  FOR SELECT TO authenticated USING (
    sale_id IN (SELECT id FROM public.sales WHERE store_id IN (SELECT public.get_user_store_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Workers can insert sale items" ON public.sale_items;
CREATE POLICY "Workers can insert sale items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (
    sale_id IN (SELECT id FROM public.sales WHERE worker_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters can manage sale items" ON public.sale_items;
CREATE POLICY "Masters can manage sale items" ON public.sale_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- Deliveries RLS Policies
DROP POLICY IF EXISTS "Masters can manage deliveries" ON public.deliveries;
CREATE POLICY "Masters can manage deliveries" ON public.deliveries
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Deliverers can view assigned deliveries" ON public.deliveries;
CREATE POLICY "Deliverers can view assigned deliveries" ON public.deliveries
  FOR SELECT TO authenticated USING (deliverer_id = auth.uid());

DROP POLICY IF EXISTS "Deliverers can update assigned deliveries" ON public.deliveries;
CREATE POLICY "Deliverers can update assigned deliveries" ON public.deliveries
  FOR UPDATE TO authenticated USING (deliverer_id = auth.uid());

-- Worker Invitations RLS Policies
DROP POLICY IF EXISTS "Masters can manage invitations" ON public.worker_invitations;
CREATE POLICY "Masters can manage invitations" ON public.worker_invitations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'master'));

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Only auto-assign master role if NOT created by an admin (no created_by metadata)
  IF NEW.raw_user_meta_data->>'created_by' IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'master')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Timestamp triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_worker_invitations_updated_at ON public.worker_invitations;
CREATE TRIGGER update_worker_invitations_updated_at BEFORE UPDATE ON public.worker_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();-- Fix the update_updated_at function to include search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;-- Relax Profiles RLS to allow all authenticated users to view names
-- This fixes issues where workers appear as "Unknown" if RLS is too strict
DROP POLICY IF EXISTS "Masters can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Authenticated can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Safety Net: Ensure the first user (Owner/Dev) has the Master role
-- This fixes the "Fake Master" issue where frontend thinks user is Master but DB doesn't
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the oldest user
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Insert master role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'master')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- Enable Row Level Security
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sale items in their stores" ON public.sale_items;
CREATE POLICY "Users can view sale items in their stores" 
ON public.sale_items 
FOR SELECT 
USING (
  sale_id IN (
    SELECT id FROM public.sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters and workers can create sale items" ON public.sale_items;
CREATE POLICY "Masters and workers can create sale items" 
ON public.sale_items 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'worker'::app_role)) 
  AND sale_id IN (
    SELECT id FROM public.sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters can update sale items" ON public.sale_items;
CREATE POLICY "Masters can update sale items" 
ON public.sale_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'master'::app_role) 
  AND sale_id IN (
    SELECT id FROM public.sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters can delete sale items" ON public.sale_items;
CREATE POLICY "Masters can delete sale items" 
ON public.sale_items 
FOR DELETE 
USING (
  has_role(auth.uid(), 'master'::app_role) 
  AND sale_id IN (
    SELECT id FROM public.sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

-- Add missing columns to sales table for POS functionality
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'detail',
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'partial')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase items table
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supplier payments table
CREATE TABLE public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Masters can manage suppliers" ON public.suppliers FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store suppliers" ON public.suppliers FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store suppliers" ON public.suppliers FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for purchase_orders
CREATE POLICY "Masters can manage purchase_orders" ON public.purchase_orders FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store purchase_orders" ON public.purchase_orders FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store purchase_orders" ON public.purchase_orders FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for purchase_items
CREATE POLICY "Masters can manage purchase_items" ON public.purchase_items FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view purchase_items" ON public.purchase_items FOR SELECT USING (order_id IN (SELECT id FROM public.purchase_orders WHERE store_id IN (SELECT get_user_store_ids(auth.uid()))));
CREATE POLICY "Workers can manage purchase_items" ON public.purchase_items FOR ALL USING (order_id IN (SELECT id FROM public.purchase_orders WHERE store_id IN (SELECT get_user_store_ids(auth.uid()))) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for supplier_payments
CREATE POLICY "Masters can manage supplier_payments" ON public.supplier_payments FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store supplier_payments" ON public.supplier_payments FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store supplier_payments" ON public.supplier_payments FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();-- Fix products RLS policy to allow INSERT operations
-- The original policy used USING only; INSERT needs WITH CHECK

DROP POLICY IF EXISTS "Masters can manage products" ON public.products;

-- Recreate masters policy with WITH CHECK so INSERTs are permitted
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
)
WITH CHECK (
  public.has_role(auth.uid(), 'master')
);

-- Allow workers to INSERT products in their assigned stores (if desired)
-- Note: choose whether workers should create products; keep strict by default.
DROP POLICY IF EXISTS "Workers can create products" ON public.products;
CREATE POLICY "Workers can create products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
  );

-- Ensure existing worker SELECT/UPDATE policies remain (no-op if already present)
-- COMPREHENSIVE FIX: Products RLS and Role Assignment
-- This migration ensures proper RLS policies AND verifies user roles exist

-- Step 1: Fix products table RLS policies (the core issue)
-- Drop all old policies
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;
DROP POLICY IF EXISTS "Workers can view store products" ON public.products;
DROP POLICY IF EXISTS "Workers can update store products" ON public.products;
DROP POLICY IF EXISTS "Workers can create products" ON public.products;

-- Step 2: Recreate ALL policies with proper WITH CHECK clauses for INSERT/UPDATE/DELETE

-- Masters can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Masters can manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

-- Workers can SELECT products from their assigned stores
CREATE POLICY "Workers can view store products"
ON public.products
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Workers can INSERT products in their assigned stores
CREATE POLICY "Workers can insert store products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Workers can UPDATE products in their assigned stores
CREATE POLICY "Workers can update store products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Step 3: Ensure first user (creator/owner) has master role assigned
-- This fixes the "user exists but has no role" issue
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the first created user
  SELECT id INTO first_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Ensure this user has the master role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'master')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Step 4: Debug info - show all policies on products table
-- Run this in SQL Editor to verify:
-- SELECT * FROM pg_policies WHERE tablename = 'products';

-- Step 5: Verification checklist:
-- 1. SELECT * FROM public.user_roles WHERE role = 'master' LIMIT 5;
--    ^ Should show at least one master user
-- 2. SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products';
--    ^ Should show 4 policies
-- 3. Try INSERT again from frontend
-- 1) Create app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.app_role AS ENUM ('master', 'worker', 'deliverer', 'customer');
  END IF;
END $$;

-- 2) Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3) Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  store_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, store_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4) Create has_role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5) Create stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- 6) Add foreign key constraint to user_roles for store_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_store_id_fkey'
      AND table_name = 'user_roles'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_roles
    ADD CONSTRAINT user_roles_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7) Create get_user_store_ids function
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.user_roles
  WHERE user_id = _user_id AND store_id IS NOT NULL
  UNION
  SELECT id FROM public.stores WHERE owner_id = _user_id
$$;

-- Alias for compatibility
CREATE OR REPLACE FUNCTION public.get_user_stores(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_store_ids(_user_id)
$$;

-- 8) RLS policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Allow role assignment on signup" ON public.user_roles;
CREATE POLICY "Allow role assignment on signup"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can update roles" ON public.user_roles;
CREATE POLICY "Masters can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can delete roles" ON public.user_roles;
CREATE POLICY "Masters can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'master'));

-- 9) RLS policies for stores
DROP POLICY IF EXISTS "Masters can manage all stores" ON public.stores;
CREATE POLICY "Masters can manage all stores"
ON public.stores FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Users can view their assigned stores" ON public.stores;
CREATE POLICY "Users can view their assigned stores"
ON public.stores FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_store_ids(auth.uid())));

-- 10) Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 11) RLS policies for products
DROP POLICY IF EXISTS "Masters can manage products" ON public.products;
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store products" ON public.products;
CREATE POLICY "Workers can view store products"
ON public.products FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can insert store products" ON public.products;
CREATE POLICY "Workers can insert store products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can update store products" ON public.products;
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

-- 12) Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON public.stores;
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13) Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();-- Fix update_updated_at_column function to set search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;-- Add advanced pricing fields to products and create product_families table

-- 1) Ensure products table has cost_price & wholesale_price columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2);

-- 2) Ensure products table exposes min_quantity (rename from legacy min_stock when needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'min_stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'min_quantity'
  ) THEN
    ALTER TABLE public.products RENAME COLUMN min_stock TO min_quantity;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'min_quantity'
  ) THEN
    ALTER TABLE public.products ADD COLUMN min_quantity INTEGER DEFAULT 0;
  END IF;
END $$;

ALTER TABLE public.products ALTER COLUMN min_quantity SET DEFAULT 0;
UPDATE public.products SET min_quantity = COALESCE(min_quantity, 0);

-- 3) Create product_families table for hierarchical categorisation
CREATE TABLE IF NOT EXISTS public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.product_families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

-- 4) Product families policies
DROP POLICY IF EXISTS "Masters can manage product_families" ON public.product_families;
DROP POLICY IF EXISTS "Workers can view product_families" ON public.product_families;
DROP POLICY IF EXISTS "Workers can manage product_families" ON public.product_families;

CREATE POLICY "Masters can manage product_families"
ON public.product_families FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Workers can view product_families"
ON public.product_families FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can manage product_families"
ON public.product_families FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can update product_families"
ON public.product_families FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can delete product_families"
ON public.product_families FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- 5) Indexes for store and parent lookups
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON public.product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON public.product_families(parent_id);

-- 6) updated_at trigger reuse
DROP TRIGGER IF EXISTS update_product_families_updated_at ON public.product_families;
CREATE TRIGGER update_product_families_updated_at
BEFORE UPDATE ON public.product_families
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create product_families table for organizing products
CREATE TABLE IF NOT EXISTS public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.product_families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON public.product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON public.product_families(parent_id);

-- Enable RLS
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Masters can manage product_families" ON public.product_families;
CREATE POLICY "Masters can manage product_families"
  ON public.product_families FOR ALL
  USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store product_families" ON public.product_families;
CREATE POLICY "Workers can view store product_families"
  ON public.product_families FOR SELECT
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Workers can manage store product_families" ON public.product_families;
CREATE POLICY "Workers can manage store product_families"
  ON public.product_families FOR ALL
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'));

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON public.product_families;
CREATE TRIGGER update_product_families_updated_at
  BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();-- Ensure helper exists for migrations/code that reference get_user_store_ids()
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_user_stores(_user_id);
$$;

-- =============================
-- product_families
-- =============================
CREATE TABLE IF NOT EXISTS public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  parent_id uuid NULL REFERENCES public.product_families(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can create product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can update product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can delete product families" ON public.product_families;

CREATE POLICY "Store owners/workers can view product families"
ON public.product_families
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create product families"
ON public.product_families
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update product families"
ON public.product_families
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete product families"
ON public.product_families
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON public.product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON public.product_families(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_families_name ON public.product_families(name);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON public.product_families;
CREATE TRIGGER update_product_families_updated_at
BEFORE UPDATE ON public.product_families
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_families TO authenticated;


-- =============================
-- products
-- =============================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  sku text NULL,
  barcode text NULL,
  category uuid NULL REFERENCES public.product_families(id) ON DELETE SET NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NULL,
  wholesale_price numeric NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 0,
  image_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  expiry_date date NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can create products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can update products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can delete products" ON public.products;

CREATE POLICY "Store owners/workers can view products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;


-- =============================
-- worker_create_product RPC (SECURITY DEFINER)
-- =============================
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, uuid, numeric, numeric, numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.worker_create_product(
  p_store_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category uuid DEFAULT NULL,
  p_unit_price numeric DEFAULT 0,
  p_cost_price numeric DEFAULT NULL,
  p_wholesale_price numeric DEFAULT NULL,
  p_min_quantity integer DEFAULT 0,
  p_quantity integer DEFAULT 0
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_product public.products%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication context is missing';
  END IF;

  IF NOT (
    (
      public.has_role(caller, 'worker'::public.app_role)
      AND p_store_id IN (SELECT public.get_user_store_ids(caller))
    )
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = p_store_id AND s.owner_id = caller
    )
    OR public.has_role(caller, 'master'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create product for this store';
  END IF;

  INSERT INTO public.products (
    store_id,
    name,
    description,
    sku,
    barcode,
    category,
    unit_price,
    cost_price,
    wholesale_price,
    min_quantity,
    quantity
  ) VALUES (
    p_store_id,
    p_name,
    NULLIF(p_description, ''),
    NULLIF(p_sku, ''),
    NULLIF(p_barcode, ''),
    p_category,
    COALESCE(p_unit_price, 0),
    p_cost_price,
    p_wholesale_price,
    COALESCE(p_min_quantity, 0),
    COALESCE(p_quantity, 0)
  )
  RETURNING * INTO new_product;

  RETURN new_product;
END;
$$;

REVOKE ALL ON FUNCTION public.worker_create_product FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_create_product TO authenticated;
-- Worker-friendly product creation helper that bypasses RLS via security definer
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, uuid, numeric, numeric, numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.worker_create_product(
  p_store_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_unit_price numeric DEFAULT 0,
  p_cost_price numeric DEFAULT NULL,
  p_wholesale_price numeric DEFAULT NULL,
  p_min_quantity integer DEFAULT 0,
  p_quantity integer DEFAULT 0
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_product public.products%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication context is missing';
  END IF;

  IF NOT (
    public.has_role(caller, 'master') OR (
      public.has_role(caller, 'worker')
      AND p_store_id IN (SELECT public.get_user_store_ids(caller))
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create product for this store';
  END IF;

  INSERT INTO public.products (
    store_id,
    name,
    description,
    sku,
    barcode,
    category,
    unit_price,
    cost_price,
    wholesale_price,
    min_quantity,
    quantity
  ) VALUES (
    p_store_id,
    p_name,
    NULLIF(p_description, ''),
    NULLIF(p_sku, ''),
    NULLIF(p_barcode, ''),
    NULLIF(p_category, ''),
    COALESCE(p_unit_price, 0),
    p_cost_price,
    p_wholesale_price,
    COALESCE(p_min_quantity, 0),
    COALESCE(p_quantity, 0)
  )
  RETURNING * INTO new_product;

  RETURN new_product;
END;
$$;

REVOKE ALL ON FUNCTION public.worker_create_product(
  uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_create_product(
  uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer
) TO authenticated;
-- Fix handle_new_user_role trigger function that was blocking sign ups
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created_by TEXT;
BEGIN
  -- When raw_user_meta_data is null, treat it as self-signup (no created_by)
  IF NEW.raw_user_meta_data IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  created_by := NEW.raw_user_meta_data->>'created_by';

  IF created_by IS NULL OR created_by = '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'master'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
-- Fix handle_new_user trigger inserting into profiles
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_full_name TEXT;
  avatar TEXT;
BEGIN
  profile_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL);

  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, profile_full_name, avatar)
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
-- Ensure profiles table has an email column for legacy triggers/functions
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMIT;
-- Migration to support offline user creation sync

CREATE TABLE IF NOT EXISTS public.offline_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  store_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS so the Sync Engine can insert into it
ALTER TABLE public.offline_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can sync offline users"
ON public.offline_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'master'
  )
);

CREATE OR REPLACE FUNCTION public.sync_offline_user_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into auth.users using the bcrypt hash
  -- Notice we set the id explicitly so it matches the local bridge UUID
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) VALUES (
      NEW.id,
      '00000000-0000-0000-0000-000000000000',
      NEW.email,
      NEW.password_hash, -- bcrypt hash generated by local bridge
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', NEW.full_name),
      NEW.created_at,
      NEW.updated_at,
      'authenticated',
      'authenticated',
      ''
    );

    -- Also insert the user role so they have the correct permissions
    INSERT INTO public.user_roles (id, user_id, role, store_id, created_at)
    VALUES (gen_random_uuid(), NEW.id, NEW.role, NEW.store_id, now())
    ON CONFLICT DO NOTHING;
    
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_offline_user_inserted ON public.offline_users;
CREATE TRIGGER on_offline_user_inserted
  AFTER INSERT ON public.offline_users
  FOR EACH ROW EXECUTE FUNCTION public.sync_offline_user_to_auth();
