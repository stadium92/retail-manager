# Lovable Prompt: Fix Worker Login Redirect

## Issue
Workers are being redirected to Master Dashboard instead of Worker Dashboard after login.

## Fix Required

### File: `src/components/auth/AuthPage.tsx`

**Line 72** - Replace hardcoded navigation with role-based routing:

#### Change This:
```tsx
if (user && !rolesLoading && roles.length > 0) {
  console.log('🚀 User authenticated with roles, navigating to dashboard...');
  const timeout = setTimeout(() => {
    console.log('📍 Navigating to /master/dashboard');
    navigate('/master/dashboard', { replace: true });
  }, 100);
  return () => clearTimeout(timeout);
}
```

#### To This:
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

#### Add Import:
```tsx
import { getDefaultDashboardRoute } from '@/utils/accessControl';
```

## Also Check Edge Function

Verify the `create-user` Edge Function is properly inserting into `user_roles` table:

```typescript
// This should exist in the Edge Function
const { error: roleError } = await supabaseAdmin
  .from('user_roles')
  .insert({
    user_id: userId,
    role,  // 'worker' or 'deliverer'
    store_id: store_id || null,
  })

if (roleError) {
  console.error('Role insert error:', roleError)
  throw roleError
}
```

## Why This Fixes It
The `getDefaultDashboardRoute` utility function (already exists in `utils/accessControl.ts`) correctly routes users based on their role:
- Master → `/master/dashboard`
- Worker → `/worker/dashboard`
- Deliverer → `/deliverer/dashboard`
