# Migration Guide: Worker Inventory & Purchasing Tables

## Overview

This document explains how to apply the pending Supabase migrations for:
1. Enhanced products table (`cost_price`, `wholesale_price`, `min_quantity`)
2. Product families table
3. `worker_create_product` RPC function
4. Suppliers & purchasing tables (`suppliers`, `purchase_orders`, `purchase_items`, `supplier_payments`)

## Required Migrations

| Migration File | Purpose |
|----------------|---------|
| `20260125110000_enhance_products_and_add_product_families.sql` | Adds pricing columns to products, creates product_families table |
| `20260125153000_create_worker_insert_product_function.sql` | Creates `worker_create_product` SECURITY DEFINER function |
| `20260125200000_create_suppliers_and_purchasing_tables.sql` | Creates suppliers, purchase_orders, purchase_items, supplier_payments tables |

## Applying Migrations

### Option A: Local Development (Supabase CLI)

```bash
# Start local Supabase (requires Docker)
cd Pro/retail-manager/frontend
npx supabase start

# Apply all pending migrations
npx supabase migration up
```

### Option B: Remote Project (Dashboard)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of each migration file (in order)
4. Paste and run the SQL

### Option C: Remote Project (CLI with db-url)

```bash
# Get your database connection string from Supabase dashboard
# Settings > Database > Connection string (URI)

npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

## Verification Steps

### 1. Verify Products Table Structure

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name IN ('cost_price', 'wholesale_price', 'min_quantity');
```

Expected: 3 rows with the new columns.

### 2. Verify Product Families Table

```sql
SELECT * FROM pg_tables WHERE tablename = 'product_families';
```

### 3. Verify Worker Create Product Function

```sql
SELECT proname FROM pg_proc WHERE proname = 'worker_create_product';
```

### 4. Verify Purchasing Tables

```sql
SELECT tablename FROM pg_tables 
WHERE tablename IN ('suppliers', 'purchase_orders', 'purchase_items', 'supplier_payments');
```

Expected: 4 rows.

### 5. Verify RLS Policies

```sql
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('suppliers', 'purchase_orders', 'purchase_items', 'supplier_payments', 'product_families');
```

## Regenerate TypeScript Types

After applying migrations, regenerate the Supabase types:

```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
# OR for remote project:
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

## Testing the Worker Product Flow

1. Sign in as a worker assigned to a store
2. Navigate to **Fichiers → Produits**
3. Click **Nouveau Produit**
4. Fill in name, prices (cost, unit, wholesale), min quantity
5. Save → should succeed with toast "Produit créé"
6. Verify product appears in the list with correct prices

## Testing the Famille-Produits Flow

1. Navigate to **Fichiers → Familles**
2. Click **Nouvelle Famille**
3. Enter name and optional description
4. Save → should succeed
5. Create a child family with parent selected
6. Verify hierarchy displays correctly
7. Edit and delete families

## Testing Purchasing Flow

1. Navigate to **Fichiers → Fournisseurs** and create a supplier
2. Navigate to **Réception Achats** for ad-hoc receipt
3. Create a receipt with products and costs
4. Verify stock quantities update
5. Navigate to **Règlements Fournisseurs** to make payments

## Troubleshooting

### Error: "Could not find column cost_price"
Migration `20260125110000` has not been applied. Run migrations.

### Error: "function worker_create_product does not exist"
Migration `20260125153000` has not been applied. Run migrations.

### Error: "relation 'suppliers' does not exist"
Migration `20260125200000` has not been applied. Run migrations.

### Error: "new row violates row-level security"
- Check that the user has the correct role (master or worker)
- Verify the user is assigned to the store via `user_roles` table
- Check that `get_user_store_ids()` returns the expected store

### TypeScript errors about missing tables
After applying migrations, regenerate types (see above).

## Related Documentation

- `RLS_FIX_GUIDE.md` - RLS troubleshooting for user_roles
- `SECURITY_IMPLEMENTATION_GUIDE.md` - Role assignment security
