-- Auto-generated from 20260125110000_enhance_products_and_add_product_families.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Add advanced pricing fields to products and create product_families table

-- 1) Ensure products table has cost_price & wholesale_price columns
ALTER TABLE products
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
    ALTER TABLE products RENAME COLUMN min_stock TO min_quantity;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'min_quantity'
  ) THEN
    ALTER TABLE products ADD COLUMN min_quantity INTEGER DEFAULT 0;
  END IF;
END $$;

ALTER TABLE products ALTER COLUMN min_quantity SET DEFAULT 0;
UPDATE products SET min_quantity = COALESCE(min_quantity, 0);

-- 3) Create product_families table for hierarchical categorisation
CREATE TABLE IF NOT EXISTS product_families (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES product_families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

-- 4) Product families policies
DROP POLICY IF EXISTS "Masters can manage product_families" ON product_families;
DROP POLICY IF EXISTS "Workers can view product_families" ON product_families;
DROP POLICY IF EXISTS "Workers can manage product_families" ON product_families;

CREATE POLICY "Masters can manage product_families"
ON product_families FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'master'))
WITH CHECK (has_role(auth.uid(), 'master'));

CREATE POLICY "Workers can view product_families"
ON product_families FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can manage product_families"
ON product_families FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can update product_families"
ON product_families FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

CREATE POLICY "Workers can delete product_families"
ON product_families FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'worker')
  AND store_id IN (SELECT get_user_store_ids(auth.uid()))
);

-- 5) Indexes for store and parent lookups
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON product_families(parent_id);

-- 6) updated_at trigger reuse
DROP TRIGGER IF EXISTS update_product_families_updated_at ON product_families;
CREATE TRIGGER update_product_families_updated_at
BEFORE UPDATE ON product_families
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
