import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canAccessRoute } from '@/utils/accessControl';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: AppRole;
  redirectTo?: string;
}

export function ProtectedRoute({ children, role, redirectTo = '/auth' }: ProtectedRouteProps) {
  const { user, loading, rolesLoading, roles } = useAuth();
  const [forceRender, setForceRender] = useState(false);

  // Force render after 2 seconds to prevent infinite loading
  useEffect(() => {
  if (loading || rolesLoading) {
      const timeout = setTimeout(() => {
        console.warn('ProtectedRoute: Loading timeout, forcing render');
        setForceRender(true);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [loading, rolesLoading]);

  // Reset forceRender when loading completes
  useEffect(() => {
    if (!loading && !rolesLoading) {
      setForceRender(false);
    }
  }, [loading, rolesLoading]);

  // If loading, show spinner but with timeout
  if ((loading || rolesLoading) && !forceRender) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  // If role is required, check if user can access it based on hierarchical permissions
  if (role) {
    const userRoles = roles.map(r => r.role);
    const hasAccess = canAccessRoute(userRoles, role);
    
    console.log('ProtectedRoute: Checking role access', {
      requiredRole: role,
      user: user?.id,
      userRoles,
      rolesCount: roles.length,
      rolesLoading,
      hasAccess,
    });

    // If roles are still loading, don't check yet (should be handled by loading check above)
    // If roles are empty but user exists, deny access (no fallback - security first)
    if (roles.length === 0 && !rolesLoading) {
      console.warn('ProtectedRoute: No roles found for user, denying access');
      console.log('ProtectedRoute: User:', user?.id, 'Role required:', role);
      return <Navigate to={redirectTo} replace />;
    }
    
    // Check hierarchical access control
    if (roles.length > 0 && !hasAccess) {
      console.warn('ProtectedRoute: User does not have access to route:', role);
      console.log('ProtectedRoute: User roles:', userRoles);
      console.log('ProtectedRoute: Required role:', role);
      console.log('ProtectedRoute: Redirecting to home page');
    return <Navigate to="/" replace />;
    }
    
    // Log successful access
    if (roles.length > 0 && hasAccess) {
      console.log('ProtectedRoute: ✅ User has access to route:', role);
    }
  }

  return <>{children}</>;
}
