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
CREATE INDEX idx_deliveries_status ON public.deliveries(status);