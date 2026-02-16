# How to Apply Migrations (Products RLS Fix)

**Migration File**: `frontend/supabase/migrations/20260124090000_fix_products_rls_insert.sql`

## Option 1: Via Supabase Dashboard (Recommended - No Setup Required)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Open **SQL Editor** (sidebar > SQL)
4. Create new query
5. Copy the contents of the migration file (`20260124090000_fix_products_rls_insert.sql`)
6. Paste and run the SQL

## Option 2: Via CLI (Requires Docker + Supabase CLI)

If you have Docker running:

```bash
cd Pro/retail-manager/frontend

# Start local Supabase
supabase start

# Apply migrations
supabase migration up
```

## What the Migration Does

Fixes the RLS policy blocking product inserts:
- Error: `new row violates row-level security policy for table "products"`
- Root cause: Policy missing `WITH CHECK` clause for INSERT operations
- Fix: Adds `WITH CHECK` for masters to insert products + allows workers to insert in their stores

## After Applying

Test product creation in the frontend:

```bash
cd Pro/retail-manager/frontend
npm run dev
# Try creating a product as master or worker
```

If still blocked, verify the user has the correct role in `user_roles` table.
