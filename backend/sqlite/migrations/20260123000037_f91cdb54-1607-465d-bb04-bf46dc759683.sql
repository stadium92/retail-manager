-- Auto-generated from 20260123000037_f91cdb54-1607-465d-bb04-bf46dc759683.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES inventory(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  discount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TEXT NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Enable Row Level Security
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sale items in their stores" ON sale_items;
CREATE POLICY "Users can view sale items in their stores" 
ON sale_items 
FOR SELECT 
USING (
  sale_id IN (
    SELECT id FROM sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters and workers can create sale items" ON sale_items;
CREATE POLICY "Masters and workers can create sale items" 
ON sale_items 
FOR INSERT 
WITH CHECK (
  (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'worker'::app_role)) 
  AND sale_id IN (
    SELECT id FROM sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters can update sale items" ON sale_items;
CREATE POLICY "Masters can update sale items" 
ON sale_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'master'::app_role) 
  AND sale_id IN (
    SELECT id FROM sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Masters can delete sale items" ON sale_items;
CREATE POLICY "Masters can delete sale items" 
ON sale_items 
FOR DELETE 
USING (
  has_role(auth.uid(), 'master'::app_role) 
  AND sale_id IN (
    SELECT id FROM sales 
    WHERE store_id IN (SELECT get_user_stores(auth.uid()))
  )
);

-- Add missing columns to sales table for POS functionality
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'detail',
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_number TEXT;
