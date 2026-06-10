-- Create role enum (if it doesn't already exist from earlier migrations)
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
CREATE TRIGGER update_worker_invitations_updated_at BEFORE UPDATE ON public.worker_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();