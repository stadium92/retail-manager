# Bug Report: Worker Login Issues (CRITICAL)

## Problem Summary
Workers created via the "Add Worker" button cannot log in properly. They are redirected to the Master Dashboard instead of the Worker Dashboard.

## Root Causes

### Issue 1: Hardcoded Navigation in `AuthPage.tsx`
**Location**: `src/components/auth/AuthPage.tsx` line 72

**Current Code**:
```tsx
if (user && !rolesLoading && roles.length > 0) {
  console.log('🚀 User authenticated with roles, navigating to dashboard...');
  const timeout = setTimeout(() => {
    console.log('📍 Navigating to /master/dashboard');
    navigate('/master/dashboard', { replace: true });  // ❌ HARDCODED!
  }, 100);
  return () => clearTimeout(timeout);
}
```

**Problem**: The navigation is hardcoded to `/master/dashboard` regardless of the user's actual role.

**Fix**: Use the `getDefaultDashboardRoute` utility function:

```tsx
if (user && !rolesLoading && roles.length > 0) {
  console.log('🚀 User authenticated with roles, navigating to dashboard...');
  const timeout = setTimeout(() => {
    const userRoles = roles.map(r => r.role);
    const dashboardRoute = getDefaultDashboardRoute(userRoles);
    console.log('📍 Navigating to', dashboardRoute, 'for roles:', userRoles);
    navigate(dashboardRoute, { replace: true });
  }, 100);
  return () => clearTimeout(timeout);
}
```

**Import Required**:
```tsx
import { getDefaultDashboardRoute } from '@/utils/accessControl';
```

### Issue 2: Role Fetch Timeout Defaults to 'master'
**Location**: `src/contexts/AuthContext.tsx` lines 43-60

**Current Code**:
```tsx
const timeoutPromise = new Promise<void>((resolve) => {
  setTimeout(() => {
    console.warn('fetchUserRoles timeout after 1s - setting default role');
    
    const role = determineRoleFromId(userId);  // ❌ Defaults to 'master'
    
    setRoles([{
      id: 'temp',
      user_id: userId,
      role: role,
      store_id: undefined,
      created_at: new Date().toISOString()
    }]);
    setRolesLoading(false);
    resolve();
  }, 1000); // 1 second timeout
});
```

**Problem**: The timeout is too aggressive (1 second) and defaults to 'master' role when the query is slow.

**Fix**: Increase timeout and improve error handling:

```tsx
const timeoutPromise = new Promise<void>((resolve) => {
  setTimeout(() => {
    console.warn('fetchUserRoles timeout after 5s - user may not have roles assigned');
    
    // Don't set a default role - let the user know there's an issue
    setRoles([]);
    setRolesLoading(false);
    resolve();
  }, 5000); // Increase to 5 seconds
});
```

### Issue 3: Edge Function May Not Be Inserting Roles
**Location**: Supabase Edge Function `create-user`

**Potential Problem**: The Edge Function might be failing to insert the role into the `user_roles` table.

**Verification Needed**: Check the Edge Function logs in Supabase Dashboard:
1. Go to Supabase Dashboard
2. Navigate to Edge Functions → `create-user` → Logs
3. Look for errors during worker creation

**Expected Behavior**: The Edge Function should:
1. Create the user in Supabase Auth
2. Insert a row into `profiles` table
3. **Insert a row into `user_roles` table with `role = 'worker'`**

**Check This Code in Edge Function**:
```typescript
// Insert user role
const { error: roleError } = await supabaseAdmin
  .from('user_roles')
  .insert({
    user_id: userId,
    role,  // Should be 'worker'
    store_id: store_id || null,
  })

if (roleError) {
  throw roleError  // This should be logged
}
```

## Testing Steps

### Step 1: Fix AuthPage Navigation
1. Update `AuthPage.tsx` with the fix above
2. Restart the dev server
3. Log in with worker credentials: `Sissoko@example.com` / `catriq-hanwuh-7poWzi`
4. Verify you are redirected to `/worker/dashboard` (not `/master/dashboard`)

### Step 2: Verify Database
1. Open Supabase Dashboard
2. Go to Table Editor → `user_roles`
3. Search for the user with email `sissoko@example.com`
4. Verify there is a row with `role = 'worker'`

### Step 3: Check Edge Function Logs
1. Go to Supabase Dashboard → Edge Functions → `create-user`
2. Check the logs for any errors during worker creation
3. If errors exist, fix the Edge Function code

## Quick Diagnostic Query

Run this in Supabase SQL Editor to check if the worker role exists:

```sql
SELECT 
  p.email,
  p.full_name,
  ur.role,
  ur.store_id,
  ur.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE p.email = 'sissoko@example.com';
```

**Expected Result**: Should show `role = 'worker'`

**If Result Shows**: No rows or `role = NULL`, then the Edge Function is not inserting the role correctly.

## Priority
**CRITICAL** - This completely breaks the worker creation feature.

## Files to Modify

1. **`src/components/auth/AuthPage.tsx`** - Fix hardcoded navigation
2. **`src/contexts/AuthContext.tsx`** - Increase timeout and improve error handling
3. **Supabase Edge Function `create-user`** - Verify role insertion logic

## Evidence

### Screenshot
![Worker logged in as Master](file:///Users/mohamedcoulibaly/.gemini/antigravity/brain/f23b53ae-aefa-428f-a2eb-b5f0e062f056/after_login_master_dashboard_1768761311128.png)

### Console Logs
```
fetchUserRoles timeout after 1s - setting default role
Timeout won, default role already set
📍 Navigating to /master/dashboard
```

This confirms both issues:
1. Role fetch times out
2. Navigation is hardcoded to master dashboard
