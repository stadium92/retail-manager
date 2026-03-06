-- 1. Tenants (Clients / Master Owners)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    master_email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active', -- active, trial, expired
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Stores (Points of Sale belonging to a Tenant)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    sync_token TEXT UNIQUE NOT NULL, -- Secret key entered in local app
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Consolidated Sales (Historical data pushed from local stores)
CREATE TABLE sales (
    id UUID PRIMARY KEY, -- Matches local ID for idempotency
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    worker_name TEXT, -- Cashier name from local
    total_price DECIMAL(12, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    sale_type TEXT NOT NULL,
    items_json JSONB NOT NULL, -- Full details stored flexibly
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AI Consultant History (Chat logs)
CREATE TABLE ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_query TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_sales_tenant_id ON sales(tenant_id);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_stores_sync_token ON stores(sync_token);
