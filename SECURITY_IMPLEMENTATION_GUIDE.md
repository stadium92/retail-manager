# Security Implementation Guide

## Overview

This guide explains the secure role assignment system and how to implement it properly.

## Current Security Issues

### ❌ Client-Side Role Assignment (INSECURE)

**Problem:**
- Role assignment happens in the browser
- Environment variables are exposed
- Can be manipulated by users

**Solution:**
- Use database triggers for automatic role assignment
- Remove client-side role assignment logic
- Keep client-side only for UI hints

## Secure Implementation

### Step 1: Run the Security Migration

```bash
# Apply the secure role assignment migration
supabase migration up
```

This creates:
- Server-side role assignment function
- Automatic trigger on profile creation
- Audit logging
- Secure RLS policies

### Step 2: Update Client Code

The client code has been updated to remove role assignment. The database trigger now handles it automatically.

### Step 3: Configure Email Patterns (Server-Side)

Edit the database function `assign_role_from_email` to match your email patterns:

```sql
-- Update the patterns in the function
master_patterns TEXT[] := ARRAY['%@yourcompany.com', 'admin@%', 'owner@%'];
worker_patterns TEXT[] := ARRAY['%@worker.yourcompany.com', 'worker@%'];
deliverer_patterns TEXT[] := ARRAY['%@deliverer.yourcompany.com', 'deliverer@%'];
```

### Step 4: Remove Client-Side Environment Variables

**DO NOT USE:**
```env
# ❌ REMOVE THESE - They're exposed to clients
VITE_MASTER_EMAILS=...
VITE_WORKER_EMAILS=...
VITE_DELIVERER_EMAILS=...
```

**USE INSTEAD:**
- Server-side environment variables (if using a backend API)
- Database configuration table (recommended)
- Email patterns in database function

### Step 5: Test the Implementation

1. Sign up with different email patterns
2. Verify roles are assigned correctly
3. Check audit logs
4. Verify RLS policies work

## Security Best Practices

### ✅ DO:

1. **Use Database Triggers** - Server-side role assignment
2. **Audit Everything** - Log all role assignments
3. **Principle of Least Privilege** - Default to customer role
4. **Validate on Server** - Never trust client input
5. **Use RLS Policies** - Database-level security
6. **Regular Audits** - Review role assignments periodically

### ❌ DON'T:

1. **Don't use VITE_* for secrets** - They're exposed to clients
2. **Don't trust client-side logic** - Always validate server-side
3. **Don't expose email patterns** - Keep them server-side
4. **Don't skip audit logging** - Track all changes
5. **Don't allow role escalation** - Prevent privilege escalation

## Monitoring & Auditing

### View Audit Logs

```sql
-- View all role assignments
SELECT 
  ral.*,
  u.email,
  u2.email as assigned_by_email
FROM public.role_audit_log ral
LEFT JOIN auth.users u ON u.id = ral.user_id
LEFT JOIN auth.users u2 ON u2.id = ral.assigned_by
ORDER BY ral.created_at DESC;
```

### Check Role Assignments

```sql
-- View all user roles
SELECT 
  ur.*,
  u.email,
  p.full_name
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
LEFT JOIN public.profiles p ON p.id = ur.user_id
ORDER BY ur.created_at DESC;
```

## Troubleshooting

### Issue: Roles not assigned on signup

1. Check if trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'auto_assign_role_trigger';
   ```

2. Check trigger function:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'auto_assign_role_on_profile_create';
   ```

3. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_roles';
   ```

### Issue: Audit logs not working

1. Check if audit log table exists
2. Check if trigger is created
3. Verify RLS policies allow insertion

## Next Steps

1. ✅ Run security migration
2. ✅ Remove client-side role assignment
3. ✅ Configure email patterns in database
4. ✅ Test role assignment
5. ✅ Set up monitoring
6. ✅ Regular security audits

