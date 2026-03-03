-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'partial')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase items table
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_ordered INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Supplier payments table
CREATE TABLE public.supplier_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Masters can manage suppliers" ON public.suppliers FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store suppliers" ON public.suppliers FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store suppliers" ON public.suppliers FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for purchase_orders
CREATE POLICY "Masters can manage purchase_orders" ON public.purchase_orders FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store purchase_orders" ON public.purchase_orders FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store purchase_orders" ON public.purchase_orders FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for purchase_items
CREATE POLICY "Masters can manage purchase_items" ON public.purchase_items FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view purchase_items" ON public.purchase_items FOR SELECT USING (order_id IN (SELECT id FROM public.purchase_orders WHERE store_id IN (SELECT get_user_store_ids(auth.uid()))));
CREATE POLICY "Workers can manage purchase_items" ON public.purchase_items FOR ALL USING (order_id IN (SELECT id FROM public.purchase_orders WHERE store_id IN (SELECT get_user_store_ids(auth.uid()))) AND has_role(auth.uid(), 'worker'::app_role));

-- RLS Policies for supplier_payments
CREATE POLICY "Masters can manage supplier_payments" ON public.supplier_payments FOR ALL USING (has_role(auth.uid(), 'master'::app_role));
CREATE POLICY "Workers can view store supplier_payments" ON public.supplier_payments FOR SELECT USING (store_id IN (SELECT get_user_store_ids(auth.uid())));
CREATE POLICY "Workers can manage store supplier_payments" ON public.supplier_payments FOR ALL USING (store_id IN (SELECT get_user_store_ids(auth.uid())) AND has_role(auth.uid(), 'worker'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();