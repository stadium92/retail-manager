import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types';
import { canAccessRoute, getPrimaryRole, getDefaultDashboardRoute } from '@/utils/accessControl';

/**
 * Hook to check access control and get user's role information
 */
export function useAccessControl() {
  const { roles } = useAuth();
  const userRoles = roles.map(r => r.role);

  return {
    roles: userRoles,
    primaryRole: getPrimaryRole(userRoles),
    canAccess: (requiredRole: AppRole) => canAccessRoute(userRoles, requiredRole),
    defaultDashboard: getDefaultDashboardRoute(userRoles),
    isMaster: userRoles.includes('master'),
    isWorker: userRoles.includes('worker'),
    isDeliverer: userRoles.includes('deliverer'),
    isCustomer: userRoles.includes('customer'),
  };
}

