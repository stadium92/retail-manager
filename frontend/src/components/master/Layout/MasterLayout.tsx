import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Store as StoreIcon,
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  Truck,
  TruckIcon,
  BarChart3,
  LogOut,
  Menu,
  Mail,
  UsersRound,
  ScrollText,
  HelpCircle
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from '@/components/shared/NotificationCenter';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { CurrencySwitcher } from '@/components/shared/CurrencySwitcher';
import { HardwareStatus } from '@/components/shared/HardwareStatus';
import { ActivationDialog } from '@/components/license/ActivationDialog';

export function MasterLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const navItems = [
    {
      title: t('sidebar.dashboard'),
      url: '/master/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: t('sidebar.stores'),
      url: '/master/stores',
      icon: StoreIcon,
    },
    {
      title: t('sidebar.inventory'),
      url: '/master/inventory',
      icon: Package,
    },
    {
      title: t('sidebar.sales'),
      url: '/master/sales',
      icon: ShoppingCart,
    },
    {
      title: t('sidebar.purchases'),
      url: '/master/purchases',
      icon: ShoppingBag,
    },
    {
      title: t('sidebar.deliverers'),
      url: '/master/deliverers',
      icon: Truck,
    },
    {
      title: t('sidebar.deliveries'),
      url: '/master/deliveries',
      icon: TruckIcon,
    },
    {
      title: t('sidebar.analytics'),
      url: '/master/analytics',
      icon: BarChart3,
    },
    {
      title: t('sidebar.invitations'),
      url: '/master/invitations',
      icon: Mail,
    },
    {
      title: t('sidebar.team'),
      url: '/master/team',
      icon: UsersRound,
    },
    {
      title: t('sidebar.systemLogs'),
      url: '/master/audit-logs',
      icon: ScrollText,
    },
    {
      title: t('common.help'),
      url: '/master/help',
      icon: HelpCircle,
    },
  ];

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex h-full flex-col ${mobile ? 'py-4' : ''}`}>
      <div className="px-4 py-6 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">
          Retail Manager
        </h2>
        <p className="text-sm text-sidebar-foreground/60">{t('sidebar.dashboard')} (Master)</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            onClick={() => mobile && setMobileMenuOpen(false)}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4 space-y-2">
        {user && (
          <p className="text-sm text-sidebar-foreground/60 truncate px-3">
            {user.email}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t('auth.signOut')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full">
      <aside className="hidden lg:flex lg:w-64 lg:flex-col border-r border-sidebar-border bg-sidebar">
        <Sidebar />
      </aside>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button
            variant="outline"
            size="icon"
            className="fixed top-4 left-4 z-50"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar">
          <Sidebar mobile />
        </SheetContent>
      </Sheet>

      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-end gap-4 px-6 py-3">
            <HardwareStatus />
            <CurrencySwitcher />
            <LanguageSwitcher />
            <NotificationCenter />
          </div>
        </div>
        <Outlet />
        <ActivationDialog />
      </main>
    </div>
  );
}