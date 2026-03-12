-- Auto-generated from 20260125140449_cba55e9a-3c3e-4856-a9e1-ce0f2c2f6545.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Create product_families table for organizing products
CREATE TABLE IF NOT EXISTS product_families (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES product_families(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT now(),
  updated_at TEXT NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON product_families(parent_id);

-- Enable RLS
ALTER TABLE product_families ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Masters can manage product_families" ON product_families;
CREATE POLICY "Masters can manage product_families"
  ON product_families FOR ALL
  USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store product_families" ON product_families;
CREATE POLICY "Workers can view store product_families"
  ON product_families FOR SELECT
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Workers can manage store product_families" ON product_families;
CREATE POLICY "Workers can manage store product_families"
  ON product_families FOR ALL
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'));

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON product_families;
CREATE TRIGGER update_product_families_updated_at
  BEFORE UPDATE ON product_families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
