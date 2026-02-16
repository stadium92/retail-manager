-- Auto-generated from 20260125143726_6587eb23-0601-4002-93b0-654c02cbab1b.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Ensure helper exists for migrations/code that reference get_user_store_ids()
CREATE OR REPLACE FUNCTION get_user_store_ids(_user_id TEXT)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER

$$;

-- =============================
-- product_families
-- =============================
CREATE TABLE IF NOT EXISTS product_families (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  parent_id TEXT NULL REFERENCES product_families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view product families" ON product_families;
DROP POLICY IF EXISTS "Store owners/workers can create product families" ON product_families;
DROP POLICY IF EXISTS "Store owners/workers can update product families" ON product_families;
DROP POLICY IF EXISTS "Store owners/workers can delete product families" ON product_families;

CREATE POLICY "Store owners/workers can view product families"
ON product_families
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create product families"
ON product_families
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update product families"
ON product_families
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete product families"
ON product_families
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON product_families(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_families_name ON product_families(name);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON product_families;
CREATE TRIGGER update_product_families_updated_at
BEFORE UPDATE ON product_families
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON product_families TO authenticated;


-- =============================
-- products
-- =============================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  sku text NULL,
  barcode text NULL,
  category TEXT NULL REFERENCES product_families(id) ON DELETE SET NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NULL,
  wholesale_price numeric NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  image_url text NULL,
  is_active INTEGER NOT NULL DEFAULT true,
  expiry_date date NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view products" ON products;
DROP POLICY IF EXISTS "Store owners/workers can create products" ON products;
DROP POLICY IF EXISTS "Store owners/workers can update products" ON products;
DROP POLICY IF EXISTS "Store owners/workers can delete products" ON products;

CREATE POLICY "Store owners/workers can view products"
ON products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create products"
ON products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update products"
ON products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete products"
ON products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;


-- =============================
-- worker_create_product RPC (SECURITY DEFINER)
-- =============================
DROP FUNCTION IF EXISTS worker_create_product(TEXT, text, text, text, text, TEXT, numeric, numeric, numeric, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION worker_create_product(
  p_store_id TEXT,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_unit_price numeric DEFAULT 0,
  p_cost_price numeric DEFAULT NULL,
  p_wholesale_price numeric DEFAULT NULL,
  p_min_quantity INTEGER DEFAULT 0,
  p_quantity INTEGER DEFAULT 0
)
RETURNS products
LANGUAGE plpgsql
SECURITY DEFINER

  caller TEXT := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication context is missing';
  END IF;

  IF NOT (
    (
      has_role(caller, 'worker'::app_role)
      AND p_store_id IN (SELECT get_user_store_ids(caller))
    )
    OR EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = p_store_id AND s.owner_id = caller
    )
    OR has_role(caller, 'master'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create product for this store';
  END IF;

  INSERT INTO products (
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

REVOKE ALL ON FUNCTION worker_create_product FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worker_create_product TO authenticated;
