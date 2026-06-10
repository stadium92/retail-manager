-- Djati (Retail Manager) Supabase Schema Setup
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard) to initialize all tables.

-- 1. Create automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    description TEXT,
    cost_price NUMERIC(12,2) DEFAULT 0,
    unit_price NUMERIC(12,2) DEFAULT 0,
    wholesale_price NUMERIC(12,2) DEFAULT 0,
    wholesale_price_ht NUMERIC(12,2) DEFAULT 0,
    wholesale_price_ttc NUMERIC(12,2) DEFAULT 0,
    selling_price_2 NUMERIC(12,2) DEFAULT 0,
    selling_price_3 NUMERIC(12,2) DEFAULT 0,
    selling_price_4 NUMERIC(12,2) DEFAULT 0,
    min_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    category TEXT,
    image_url TEXT,
    aisle TEXT,
    brand TEXT,
    unit_type TEXT,
    packaging TEXT,
    expiry_date TEXT,
    reorder_quantity INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    worker_id UUID,
    client_id UUID,
    customer_name TEXT,
    customer_phone TEXT,
    sale_type TEXT NOT NULL DEFAULT 'detail',
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'paid',
    notes TEXT,
    invoice_number TEXT,
    version INTEGER DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create sale_items table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID,
    product_name TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    version INTEGER DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Disable RLS to allow the anon client to push and pull synchronization data
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items DISABLE ROW LEVEL SECURITY;

-- 6. Create indexes for ultra-fast synchronization queries
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON public.products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);

CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON public.sales(updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales(store_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_updated_at ON public.sale_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);

-- 7. Add updated_at triggers
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sale_items_updated_at ON public.sale_items;
CREATE TRIGGER trg_sale_items_updated_at
BEFORE UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
