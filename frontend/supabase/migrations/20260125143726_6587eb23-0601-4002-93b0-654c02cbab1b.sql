-- Ensure helper exists for migrations/code that reference get_user_store_ids()
CREATE OR REPLACE FUNCTION public.get_user_store_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_user_stores(_user_id);
$$;

-- =============================
-- product_families
-- =============================
CREATE TABLE IF NOT EXISTS public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  parent_id uuid NULL REFERENCES public.product_families(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can create product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can update product families" ON public.product_families;
DROP POLICY IF EXISTS "Store owners/workers can delete product families" ON public.product_families;

CREATE POLICY "Store owners/workers can view product families"
ON public.product_families
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create product families"
ON public.product_families
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update product families"
ON public.product_families
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete product families"
ON public.product_families
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON public.product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON public.product_families(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_families_name ON public.product_families(name);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON public.product_families;
CREATE TRIGGER update_product_families_updated_at
BEFORE UPDATE ON public.product_families
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_families TO authenticated;


-- =============================
-- products
-- =============================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  sku text NULL,
  barcode text NULL,
  category uuid NULL REFERENCES public.product_families(id) ON DELETE SET NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NULL,
  wholesale_price numeric NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 0,
  image_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  expiry_date date NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "Store owners/workers can view products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can create products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can update products" ON public.products;
DROP POLICY IF EXISTS "Store owners/workers can delete products" ON public.products;

CREATE POLICY "Store owners/workers can view products"
ON public.products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can create products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

CREATE POLICY "Store owners/workers can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR store_id IN (SELECT public.get_user_store_ids(auth.uid()))
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;


-- =============================
-- worker_create_product RPC (SECURITY DEFINER)
-- =============================
DROP FUNCTION IF EXISTS public.worker_create_product(uuid, text, text, text, text, uuid, numeric, numeric, numeric, integer, integer);

CREATE OR REPLACE FUNCTION public.worker_create_product(
  p_store_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_barcode text DEFAULT NULL,
  p_category uuid DEFAULT NULL,
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
    (
      public.has_role(caller, 'worker'::public.app_role)
      AND p_store_id IN (SELECT public.get_user_store_ids(caller))
    )
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = p_store_id AND s.owner_id = caller
    )
    OR public.has_role(caller, 'master'::public.app_role)
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

REVOKE ALL ON FUNCTION public.worker_create_product FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worker_create_product TO authenticated;
