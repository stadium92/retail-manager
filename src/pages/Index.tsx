import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Store, TrendingUp, Users, Package, Loader2 } from 'lucide-react';
import { getDefaultDashboardRoute } from '@/utils/accessControl';
import { useTranslation } from 'react-i18next';

const Index = () => {
  const navigate = useNavigate();
  const { user, rolesLoading, loading, roles } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (loading || rolesLoading) return;
    
    if (user && roles.length > 0) {
      // Redirect based on user's primary role (highest privilege)
      const dashboardRoute = getDefaultDashboardRoute(roles.map(r => r.role));
      console.log('Index: Redirecting user to dashboard:', dashboardRoute);
      navigate(dashboardRoute, { replace: true });
    } else if (!user) {
      // Not logged in - show landing page
      // Landing page is already shown below
    }
  }, [user, rolesLoading, roles, navigate, loading]);

  // Show loading state ONLY if user exists and roles are loading
  // If no user, show the landing page immediately (optimistic rendering)
  if (user && rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is authenticated and has roles, redirect to dashboard (handled by useEffect)
  // But don't return null here - let the useEffect handle the redirect
  // This ensures the page shows while redirect is happening
  if (user && roles.length > 0) {
    // Show a brief loading state while redirecting
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is true but no user, show the landing page anyway
  // This prevents the "Get Started" page from being hidden during initial auth check

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="mobile-container text-center space-y-8 py-12">
        <div className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary">
            <Store className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-5xl font-bold">{t('index.title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('index.description')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          <div className="p-6 bg-card rounded-lg shadow-card space-y-2">
            <TrendingUp className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">{t('index.features.sales.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.features.sales.description')}</p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-card space-y-2">
            <Package className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">{t('index.features.inventory.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.features.inventory.description')}</p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-card space-y-2">
            <Users className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">{t('index.features.team.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('index.features.team.description')}</p>
          </div>
        </div>

        <Button size="lg" onClick={() => navigate('/auth', { state: { fromGetStarted: true } })} className="text-lg px-8">
          {t('index.getStarted')}
        </Button>
      </div>
    </div>
  );
};

export default Index;
