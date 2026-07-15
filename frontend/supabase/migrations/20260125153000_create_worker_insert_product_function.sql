-- Worker-friendly product creation helper that bypasses RLS via security definer
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer);
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, uuid, numeric, numeric, numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.worker_create_product(
  p_store_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_unit_price numeric DEFAULT 0,
  p_cost_price numeric DEFAULT NULL,
  p_wholesale_price numeric DEFAULT NULL,
  p_min_quantity integer DEFAULT 0,
  p_quantity integer DEFAULT 0
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_product public.products%ROWTYPE;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication context is missing';
  END IF;

  IF NOT (
    public.has_role(caller, 'master') OR (
      public.has_role(caller, 'worker')
      AND p_store_id IN (SELECT public.get_user_store_ids(caller))
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create product for this store';
  END IF;

  INSERT INTO public.products (
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

REVOKE ALL ON FUNCTION public.worker_create_product(
  uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_create_product(
  uuid, text, text, text, text, text, numeric, numeric, numeric, integer, integer
) TO authenticated;
