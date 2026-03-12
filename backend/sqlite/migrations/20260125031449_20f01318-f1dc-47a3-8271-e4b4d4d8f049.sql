-- Auto-generated from 20260125031449_20f01318-f1dc-47a3-8271-e4b4d4d8f049.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- 1) Create app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace
  ) THEN
    -- NOTE: enum definition requires manual conversion
  END IF;
END $$;

-- 2) Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3) Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  store_id TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, store_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 4) Create has_role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION has_role(_user_id TEXT, _role app_role)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER


-- 5) Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  owner_id TEXT REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 6) Add foreign key constraint to user_roles for store_id
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
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7) Create get_user_store_ids function
CREATE OR REPLACE FUNCTION get_user_store_ids(_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER


-- Alias for compatibility
CREATE OR REPLACE FUNCTION get_user_stores(_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER


-- 8) RLS policies for user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles"
ON user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Allow role assignment on signup" ON user_roles;
CREATE POLICY "Allow role assignment on signup"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can update roles" ON user_roles;
CREATE POLICY "Masters can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Masters can delete roles" ON user_roles;
CREATE POLICY "Masters can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'master'));

-- 9) RLS policies for stores
DROP POLICY IF EXISTS "Masters can manage all stores" ON stores;
CREATE POLICY "Masters can manage all stores"
ON stores FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'))
WITH CHECK (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Users can view their assigned stores" ON stores;
CREATE POLICY "Users can view their assigned stores"
ON stores FOR SELECT
TO authenticated
USING (id IN (SELECT get_user_store_ids(auth.uid())));

-- 10) Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- 11) RLS policies for products
DROP POLICY IF EXISTS "Masters can manage products" ON products;
CREATE POLICY "Masters can manage products"
ON products FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'))
WITH CHECK (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store products" ON products;
CREATE POLICY "Workers can view store products"
ON products FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can insert store products" ON products;
CREATE POLICY "Workers can insert store products"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Workers can update store products" ON products;
CREATE POLICY "Workers can update store products"
ON products FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- 12) Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 13) Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
