import { AppRole } from '@/types';

/**
 * Access Control Hierarchy:
 * - Master: Can access ALL pages (master, worker, deliverer, customer)
 * - Worker: Can access worker, deliverer, customer pages
 * - Deliverer: Can access deliverer, customer pages
 * - Customer: Can only access customer pages (public)
 */

// Define which roles can access which routes
const ROLE_ACCESS_MAP: Record<AppRole, AppRole[]> = {
  master: ['master', 'worker', 'deliverer', 'customer', 'cashier', 'cook', 'waiter', 'waiters'], // Master can access everything
  worker: ['worker', 'deliverer', 'customer', 'cashier', 'cook', 'waiter', 'waiters'], // Worker can access worker, deliverer, customer
  cashier: ['worker', 'cashier', 'deliverer', 'customer'],
  cook: ['worker', 'cook', 'deliverer', 'customer'],
  waiter: ['worker', 'waiter', 'deliverer', 'customer'],
  waiters: ['worker', 'waiters', 'waiter', 'deliverer', 'customer'],
  deliverer: ['deliverer', 'customer'], // Deliverer can access deliverer, customer
  customer: ['customer'], // Customer can only access customer pages
};

/**
 * Check if a user with the given roles can access a route requiring a specific role
 */
export function canAccessRoute(userRoles: AppRole[], requiredRole: AppRole): boolean {
  // If user has no roles, deny access
  if (userRoles.length === 0) {
    return false;
  }

  // Check if user has master role (can access everything)
  if (userRoles.includes('master')) {
    return true;
  }

  // Check if any of the user's roles can access the required role
  for (const userRole of userRoles) {
    const allowedRoles = ROLE_ACCESS_MAP[userRole];
    if (allowedRoles && allowedRoles.includes(requiredRole)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the primary role (highest privilege) from a list of roles
 */
export function getPrimaryRole(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null;
  
  // Priority order: master > worker > cashier > cook > waiter > waiters > deliverer > customer
  const priority: AppRole[] = ['master', 'worker', 'cashier', 'cook', 'waiter', 'waiters', 'deliverer', 'customer'];
  
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  
  return roles[0];
}

/**
 * Get the default dashboard route for a user based on their primary role
 */
export function getDefaultDashboardRoute(roles: AppRole[]): string {
  const primaryRole = getPrimaryRole(roles);
  
  switch (primaryRole) {
    case 'master':
      return '/master/dashboard';
    case 'worker':
    case 'cashier':
    case 'cook':
    case 'waiter':
    case 'waiters':
      return '/worker/dashboard';
    case 'deliverer':
      return '/deliverer/dashboard';
    case 'customer':
      return '/customer/browse';
    default:
      return '/';
  }
}

/**
 * Check if a route is public (doesn't require authentication)
 */
export function isPublicRoute(path: string): boolean {
  const publicRoutes = ['/', '/auth', '/customer/browse', '/customer'];
  return publicRoutes.some(route => path.startsWith(route));
}

