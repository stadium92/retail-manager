# Access Control System

## Overview

This document describes the hierarchical access control system implemented for the Retail Manager application.

## Access Hierarchy

The system implements a hierarchical permission model where higher-level roles can access lower-level interfaces:

### Role Permissions

1. **Master** (Highest Privilege)
   - ✅ Can access ALL pages:
     - Master Dashboard (`/master/dashboard`)
     - Worker Dashboard (`/worker/dashboard`)
     - Deliverer Dashboard (`/deliverer/dashboard`)
     - Customer Browse (`/customer/browse`)

2. **Worker**
   - ✅ Can access:
     - Worker Dashboard (`/worker/dashboard`)
     - Deliverer Dashboard (`/deliverer/dashboard`)
     - Customer Browse (`/customer/browse`)
   - ❌ Cannot access:
     - Master Dashboard (`/master/dashboard`)

3. **Deliverer**
   - ✅ Can access:
     - Deliverer Dashboard (`/deliverer/dashboard`)
     - Customer Browse (`/customer/browse`)
   - ❌ Cannot access:
     - Master Dashboard (`/master/dashboard`)
     - Worker Dashboard (`/worker/dashboard`)

4. **Customer** (Public)
   - ✅ Can access:
     - Customer Browse (`/customer/browse`) - Public access, no authentication required
   - ❌ Cannot access:
     - Master Dashboard (`/master/dashboard`)
     - Worker Dashboard (`/worker/dashboard`)
     - Deliverer Dashboard (`/deliverer/dashboard`)

## Implementation

### Access Control Utility (`src/utils/accessControl.ts`)

The access control logic is centralized in `accessControl.ts`:

- `canAccessRoute(userRoles, requiredRole)`: Checks if a user with given roles can access a route
- `getPrimaryRole(roles)`: Returns the highest privilege role from a list
- `getDefaultDashboardRoute(roles)`: Returns the default dashboard route based on primary role
- `isPublicRoute(path)`: Checks if a route is publicly accessible

### Protected Route Component

The `ProtectedRoute` component uses the access control utility to enforce permissions:

```tsx
<ProtectedRoute role="worker">
  <WorkerDashboard />
</ProtectedRoute>
```

This will:
1. Check if the user is authenticated
2. Check if the user's roles allow access to the required role
3. Redirect to home if access is denied

### Default Dashboard Routing

When a user logs in, they are automatically redirected to their primary role's dashboard:
- Master → `/master/dashboard`
- Worker → `/worker/dashboard`
- Deliverer → `/deliverer/dashboard`
- Customer → `/customer/browse`

## Usage Examples

### Check Access in Components

```tsx
import { useAccessControl } from '@/hooks/useAccessControl';

function MyComponent() {
  const { canAccess, isMaster, isWorker } = useAccessControl();
  
  if (canAccess('master')) {
    // Show master-only content
  }
  
  if (isWorker) {
    // Show worker-specific content
  }
}
```

### Protect Routes

```tsx
<Route 
  path="/worker/dashboard" 
  element={
    <ProtectedRoute role="worker">
      <WorkerDashboard />
    </ProtectedRoute>
  } 
/>
```

## Database Setup

Users must have roles assigned in the `user_roles` table:

```sql
-- Example: Assign master role to a user
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'master', 'store-uuid');

-- Example: Assign worker role to a user
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'worker', 'store-uuid');

-- Example: Assign deliverer role to a user
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'deliverer', 'store-uuid');
```

## Security Notes

1. **No Fallback Access**: If a user has no roles, they are denied access (no fallback to allow access)
2. **Role Hierarchy**: Higher roles automatically have access to lower role interfaces
3. **Public Routes**: Customer browse is public and doesn't require authentication
4. **Route Protection**: All protected routes check permissions before rendering

## Testing

To test access control:

1. Create users with different roles in the database
2. Log in with each user
3. Verify they can only access allowed routes
4. Check browser console for access control logs

