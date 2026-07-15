-- Fix products RLS policy to allow INSERT operations
-- The original policy used USING only; INSERT needs WITH CHECK

DROP POLICY IF EXISTS "Masters can manage products" ON public.products;

-- Recreate masters policy with WITH CHECK so INSERTs are permitted
CREATE POLICY "Masters can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'master')
)
WITH CHECK (
  public.has_role(auth.uid(), 'master')
);

-- Allow workers to INSERT products in their assigned stores (if desired)
-- Note: choose whether workers should create products; keep strict by default.
DROP POLICY IF EXISTS "Workers can create products" ON public.products;
CREATE POLICY "Workers can create products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'worker')
    AND store_id IN (SELECT public.get_user_store_ids(auth.uid()))
  );

-- Ensure existing worker SELECT/UPDATE policies remain (no-op if already present)
