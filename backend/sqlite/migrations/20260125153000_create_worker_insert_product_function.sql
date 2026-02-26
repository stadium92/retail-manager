-- Auto-generated from 20260125153000_create_worker_insert_product_function.sql
-- Review required: verify constraints and triggers for SQLite compatibility.

-- Worker-friendly product creation helper that bypasses RLS via security definer
DROP FUNCTION IF EXISTS worker_create_product(TEXT, text, text, text, text, text, numeric, numeric, numeric, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS worker_create_product(TEXT, text, text, text, text, TEXT, numeric, numeric, numeric, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION worker_create_product(
  p_store_id TEXT,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category text DEFAULT NULL,
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
    has_role(caller, 'master') OR (
      has_role(caller, 'worker')
      AND p_store_id IN (SELECT get_user_store_ids(caller))
    )
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

REVOKE ALL ON FUNCTION worker_create_product(
  TEXT, text, text, text, text, text, numeric, numeric, numeric, INTEGER, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION worker_create_product(
  TEXT, text, text, text, text, text, numeric, numeric, numeric, INTEGER, INTEGER
) TO authenticated;
