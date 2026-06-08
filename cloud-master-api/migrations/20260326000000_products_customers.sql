-- Migration: Add Products and Customers for Cloud Backup
-- This ensures that every store has a full off-site backup.

-- 1. Cloud Products Table
CREATE TABLE products (
    id UUID PRIMARY KEY, -- Matches local product ID
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    family_id TEXT, -- Can be UUID or string based on local
    brand TEXT,
    purchase_price DECIMAL(12, 2) DEFAULT 0,
    selling_price_detail DECIMAL(12, 2) DEFAULT 0,
    quantity DECIMAL(12, 3) DEFAULT 0,
    unit_type TEXT DEFAULT 'Pièce',
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cloud Customers Table
CREATE TABLE customers (
    id UUID PRIMARY KEY, -- Matches local customer ID
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance DECIMAL(12, 2) DEFAULT 0, -- Loyalty or credit balance
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Performance Indexes
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_products_barcode ON products(barcode);
