-- Auto-generated from 20260121134521_a0a4a921-3a70-4269-8a81-839bf76c7074.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Create role enum (if it doesn't already exist from earlier migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace
  ) THEN
    -- NOTE: enum definition requires manual conversion
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  store_id TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  owner_id TEXT REFERENCES auth.users(id),
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
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
    ALTER TABLE user_roles 
    ADD CONSTRAINT user_roles_store_id_fkey 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS products (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
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
  is_active INTEGER DEFAULT true,
  expiry_date DATE,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  worker_id TEXT REFERENCES auth.users(id),
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
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id TEXT REFERENCES sales(id),
  store_id TEXT REFERENCES stores(id),
  deliverer_id TEXT REFERENCES auth.users(id),
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled')),
  notes TEXT,
  scheduled_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_invitations (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  store_id TEXT REFERENCES stores(id),
  invited_by TEXT REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TEXT NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_invitations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION has_role(_user_id TEXT, _role app_role)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER


-- Function to get user's store IDs
CREATE OR REPLACE FUNCTION get_user_store_ids(_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER


DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Allow insert for new users" ON profiles;
CREATE POLICY "Allow insert for new users" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Masters can view all profiles" ON profiles;
CREATE POLICY "Masters can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'master'));

-- User Roles RLS Policies (simple, non-recursive)
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Masters can view all roles" ON user_roles;
CREATE POLICY "Masters can view all roles" ON user_roles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can insert roles" ON user_roles;
CREATE POLICY "Masters can insert roles" ON user_roles
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can update roles" ON user_roles;
CREATE POLICY "Masters can update roles" ON user_roles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can delete roles" ON user_roles;
CREATE POLICY "Masters can delete roles" ON user_roles
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'master'));

-- Stores RLS Policies
DROP POLICY IF EXISTS "Masters can manage stores" ON stores;
CREATE POLICY "Masters can manage stores" ON stores
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view assigned stores" ON stores;
CREATE POLICY "Workers can view assigned stores" ON stores
  FOR SELECT TO authenticated USING (id IN (SELECT get_user_store_ids(auth.uid())));

-- Products RLS Policies
DROP POLICY IF EXISTS "Masters can manage products" ON products;
CREATE POLICY "Masters can manage products"
ON products FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'master')
)
WITH CHECK (
  has_role(auth.uid(), 'master')
);

DROP POLICY IF EXISTS "Workers can view store products" ON products;
CREATE POLICY "Workers can view store products" ON products
  FOR SELECT TO authenticated USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Workers can update store products" ON products;
CREATE POLICY "Workers can update store products" ON products
  FOR UPDATE TO authenticated USING (
    store_id IN (SELECT get_user_store_ids(auth.uid()))
    AND has_role(auth.uid(), 'worker')
  );

DROP POLICY IF EXISTS "Workers can create products" ON products;
CREATE POLICY "Workers can create products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT get_user_store_ids(auth.uid()))
  );

-- Sales RLS Policies
DROP POLICY IF EXISTS "Masters can manage sales" ON sales;
CREATE POLICY "Masters can manage sales" ON sales
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can create sales" ON sales;
CREATE POLICY "Workers can create sales" ON sales
  FOR INSERT TO authenticated WITH CHECK (
    has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT get_user_store_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Workers can view store sales" ON sales;
CREATE POLICY "Workers can view store sales" ON sales
  FOR SELECT TO authenticated USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

-- Sale Items RLS Policies
DROP POLICY IF EXISTS "Users can view sale items for accessible sales" ON sale_items;
CREATE POLICY "Users can view sale items for accessible sales" ON sale_items
  FOR SELECT TO authenticated USING (
    sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT get_user_store_ids(auth.uid())))
  );

DROP POLICY IF EXISTS "Workers can insert sale items" ON sale_items;
CREATE POLICY "Workers can insert sale items" ON sale_items
  FOR INSERT TO authenticated WITH CHECK (
    sale_id IN (SELECT id FROM sales WHERE worker_id = auth.uid())
  );

DROP POLICY IF EXISTS "Masters can manage sale items" ON sale_items;
CREATE POLICY "Masters can manage sale items" ON sale_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'));

-- Deliveries RLS Policies
DROP POLICY IF EXISTS "Masters can manage deliveries" ON deliveries;
CREATE POLICY "Masters can manage deliveries" ON deliveries
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Deliverers can view assigned deliveries" ON deliveries;
CREATE POLICY "Deliverers can view assigned deliveries" ON deliveries
  FOR SELECT TO authenticated USING (deliverer_id = auth.uid());

DROP POLICY IF EXISTS "Deliverers can update assigned deliveries" ON deliveries;
CREATE POLICY "Deliverers can update assigned deliveries" ON deliveries
  FOR UPDATE TO authenticated USING (deliverer_id = auth.uid());

-- Worker Invitations RLS Policies
DROP POLICY IF EXISTS "Masters can manage invitations" ON worker_invitations;
CREATE POLICY "Masters can manage invitations" ON worker_invitations
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'));

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER

  
  -- Only auto-assign master role if NOT created by an admin (no created_by metadata)
  IF NEW.raw_user_meta_data->>'created_by' IS NULL THEN
    INSERT INTO user_roles (user_id, role)
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
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Timestamp triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_worker_invitations_updated_at ON worker_invitations;
CREATE TRIGGER update_worker_invitations_updated_at BEFORE UPDATE ON worker_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
