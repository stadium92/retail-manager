-- Create product_families table for organizing products
CREATE TABLE IF NOT EXISTS public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.product_families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_families_store_id ON public.product_families(store_id);
CREATE INDEX IF NOT EXISTS idx_product_families_parent_id ON public.product_families(parent_id);

-- Enable RLS
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Masters can manage product_families" ON public.product_families;
CREATE POLICY "Masters can manage product_families"
  ON public.product_families FOR ALL
  USING (has_role(auth.uid(), 'master'));

DROP POLICY IF EXISTS "Workers can view store product_families" ON public.product_families;
CREATE POLICY "Workers can view store product_families"
  ON public.product_families FOR SELECT
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())));

DROP POLICY IF EXISTS "Workers can manage store product_families" ON public.product_families;
CREATE POLICY "Workers can manage store product_families"
  ON public.product_families FOR ALL
  USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'));

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_product_families_updated_at ON public.product_families;
CREATE TRIGGER update_product_families_updated_at
  BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();