# RLS Policy Fix Guide for user_roles Table

## Problem

The error `"new row violates row-level security policy for table \"user_roles\""` occurs because the RLS policies on the `user_roles` table are too restrictive and prevent role assignment during signup.

## Root Cause

1. **Conflicting Policies**: Multiple migrations created conflicting INSERT policies
2. **Store ID Requirement**: The initial policy required `store_id` to be in the user's stores, but during signup, users don't have stores yet
3. **Policy Precedence**: The policies weren't allowing users to insert their own role during signup

## Solution

A new migration (`20251106130000_fix_user_roles_rls.sql`) has been created that:

1. **Drops conflicting policies** and creates clean, non-conflicting ones
2. **Allows signup role assignment** by permitting users to insert their own role with `store_id = NULL`
3. **Allows master role assignment** by permitting masters to insert roles for others
4. **Updates trigger functions** to ensure they work correctly with the new policies

## How to Apply the Fix

### Option 1: Apply via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20251106130000_fix_user_roles_rls.sql`
4. Paste and run the SQL in the SQL Editor
5. Verify the policies were created successfully

### Option 2: Apply via Supabase CLI

```bash
cd Pro/retail-manager/frontend
supabase db push
```

Or if you're using migrations:

```bash
supabase migration up
```

### Option 3: Apply Manually

1. Open `supabase/migrations/20251106130000_fix_user_roles_rls.sql`
2. Copy the SQL
3. Run it in your Supabase SQL Editor

## Verification Steps

### 1. Check Policies Were Created

Run this query in Supabase SQL Editor:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_roles'
ORDER BY policyname;
```

You should see these policies:
- `Users can view their own roles and store roles` (SELECT)
- `Allow role assignment on signup and by masters` (INSERT)
- `Masters can update roles in their stores` (UPDATE)
- `Masters can delete roles in their stores` (DELETE)

### 2. Test Signup Role Assignment

1. **Sign up a new user** with an email that matches a role pattern (e.g., `test@master.example.com`)
2. **Check the `user_roles` table** to see if the role was assigned:

```sql
SELECT 
  ur.*,
  au.email
FROM public.user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'test@master.example.com';
```

You should see a row with the assigned role.

### 3. Test Master Role Assignment

1. **As a master user**, try to assign a role to another user using the `assign_role_manually` function:

```sql
SELECT public.assign_role_manually(
  'user-uuid-here'::uuid,
  'worker'::public.app_role,
  'store-uuid-here'::uuid
);
```

This should return `true` if successful.

### 4. Test Client-Side Role Assignment

If your frontend code tries to insert roles directly (not recommended, but for testing):

```sql
-- This should work if you're signed in as the user
INSERT INTO public.user_roles (user_id, role, store_id)
VALUES (auth.uid(), 'customer'::public.app_role, NULL);
```

## Expected Behavior After Fix

1. **During Signup**: 
   - The trigger `auto_assign_role_on_profile_create()` runs
   - It inserts a role into `user_roles` with `store_id = NULL`
   - The INSERT policy allows this because `user_id = auth.uid()` and `store_id IS NULL`

2. **Master Assigning Roles**:
   - Masters can use `assign_role_manually()` function
   - Or directly insert into `user_roles` (if they have master role)
   - The INSERT policy allows this because `has_role(auth.uid(), 'master')` is true

3. **Viewing Roles**:
   - Users can view their own roles (including global roles with `store_id IS NULL`)
   - Users can view roles in stores they have access to
   - Masters can view all roles in their stores

## Troubleshooting

### Issue: Still Getting RLS Error

**Solution**: 
1. Verify the migration ran successfully
2. Check that the policies exist (use verification query above)
3. Ensure you're using the correct user context (signed in as the user during signup)

### Issue: Trigger Not Running

**Solution**:
1. Check if the trigger exists:

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%role%';
```

2. If the trigger doesn't exist, the migration might not have run. Re-run the migration.

### Issue: Roles Not Being Assigned During Signup

**Solution**:
1. Check if the profile trigger is firing:

```sql
-- Check if profiles are being created
SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 5;
```

2. Check if the trigger function is working:

```sql
-- Test the function directly
SELECT public.assign_role_from_email(
  auth.uid(),
  'test@master.example.com'
);
```

3. Check trigger logs (if available in Supabase)

## Security Notes

- **SECURITY DEFINER Functions**: The trigger functions use `SECURITY DEFINER`, which means they run with the privileges of the function owner (usually the database owner), bypassing RLS. However, the policies are still important for client-side operations.

- **Client-Side Inserts**: While the policies allow client-side inserts during signup, it's recommended to use the trigger-based approach for automatic role assignment.

- **Master Role Assignment**: Only users with the 'master' role can assign roles to others. This is enforced by the `assign_role_manually()` function and the RLS policies.

## Next Steps

After applying the fix:

1. **Test signup flow** - Create a new user and verify role assignment
2. **Test master features** - Verify masters can assign roles to workers/deliverers
3. **Monitor for errors** - Check Supabase logs for any RLS policy violations
4. **Update frontend** - If you have any client-side role assignment code, ensure it handles the new policy structure

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- Migration file: `supabase/migrations/20251106130000_fix_user_roles_rls.sql`




