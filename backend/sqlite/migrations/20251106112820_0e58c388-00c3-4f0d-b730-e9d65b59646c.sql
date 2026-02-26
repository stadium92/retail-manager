-- Auto-generated from 20251106112820_0e58c388-00c3-4f0d-b730-e9d65b59646c.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Create enum for user roles
-- NOTE: enum definition requires manual conversion

-- Create enum for delivery status
-- NOTE: enum definition requires manual conversion

-- Create enum for sales status
-- NOTE: enum definition requires manual conversion

-- Create stores table
CREATE TABLE stores (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    owner_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create profiles table (extends auth.users with role and store info)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE user_roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    store_id TEXT REFERENCES stores(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT now(),
    UNIQUE(user_id, role, store_id)
);

-- Create categories table
CREATE TABLE categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create inventory table
CREATE TABLE inventory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cost DECIMAL(10, 2) DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE sales (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    worker_id TEXT REFERENCES auth.users(id) ON DELETE SET NULL,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    sale_date TEXT NOT NULL DEFAULT now(),
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create deliverers table
CREATE TABLE deliverers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    vehicle_type TEXT,
    vehicle_number TEXT,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    is_active INTEGER DEFAULT true,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Create deliveries table
CREATE TABLE deliveries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
    deliverer_id TEXT REFERENCES deliverers(id) ON DELETE SET NULL,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status delivery_status NOT NULL DEFAULT 'pending',
    assigned_at TEXT,
    picked_up_at TEXT,
    delivered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT now(),
    updated_at TEXT NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION has_role(_user_id TEXT, _role app_role)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER


-- Create function to get user's stores
CREATE OR REPLACE FUNCTION get_user_stores(_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER


-- RLS Policies for stores
CREATE POLICY "Users can view their own stores"
ON stores FOR SELECT
USING (owner_id = auth.uid() OR id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can insert stores"
ON stores FOR INSERT
WITH CHECK (owner_id = auth.uid() AND has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can update their stores"
ON stores FOR UPDATE
USING (owner_id = auth.uid() AND has_role(auth.uid(), 'master'));

CREATE POLICY "Masters can delete their stores"
ON stores FOR DELETE
USING (owner_id = auth.uid() AND has_role(auth.uid(), 'master'));

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their stores"
ON user_roles FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can insert roles in their stores"
ON user_roles FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can delete roles in their stores"
ON user_roles FOR DELETE
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their stores"
ON categories FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage categories"
ON categories FOR ALL
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- RLS Policies for inventory
CREATE POLICY "Users can view inventory in their stores"
ON inventory FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage inventory"
ON inventory FOR ALL
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- RLS Policies for sales
CREATE POLICY "Users can view sales in their stores"
ON sales FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters and workers can create sales"
ON sales FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'worker')) AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can update sales"
ON sales FOR UPDATE
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

CREATE POLICY "Masters can delete sales"
ON sales FOR DELETE
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- RLS Policies for deliverers
CREATE POLICY "Users can view deliverers in their stores"
ON deliverers FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage deliverers"
ON deliverers FOR ALL
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- RLS Policies for deliveries
CREATE POLICY "Users can view deliveries in their stores"
ON deliveries FOR SELECT
USING (store_id IN (SELECT get_user_stores(auth.uid())));

CREATE POLICY "Masters can manage deliveries"
ON deliveries FOR ALL
USING (
  has_role(auth.uid(), 'master') AND
  store_id IN (SELECT get_user_stores(auth.uid()))
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverers_updated_at BEFORE UPDATE ON deliverers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_store_id ON user_roles(store_id);
CREATE INDEX idx_categories_store_id ON categories(store_id);
CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_category_id ON inventory(category_id);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_worker_id ON sales(worker_id);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);
CREATE INDEX idx_deliverers_store_id ON deliverers(store_id);
CREATE INDEX idx_deliveries_store_id ON deliveries(store_id);
CREATE INDEX idx_deliveries_deliverer_id ON deliveries(deliverer_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
