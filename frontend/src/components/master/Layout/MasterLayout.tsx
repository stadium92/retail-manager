import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoUrl from '@/assets/logo.png';
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
  HelpCircle,
  Cloud,
  KeyRound
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
import { StoreMultiSelector } from './StoreMultiSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function MasterLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('All fields are required.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { getDataClient } = await import('@/lib/dataClient');
      const { OfflineAuthService } = await import('@/services/OfflineAuthService');
      const dc = getDataClient();
      const headers = await OfflineAuthService.getAuthHeaders();
      if (!headers) throw new Error('Session expired');
      const res = await fetch(`${dc.localBridgeBaseUrl}/rest/v1/auth/update-password`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword 
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || 'Password update failed');
      }
      toast.success('Password updated successfully');
      setIsPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Error updating password');
    } finally {
      setIsChangingPassword(false);
    }
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
      title: t('menu.files.title') || 'Fichiers',
      url: '/master/files',
      icon: ScrollText, 
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
      title: 'Cloud Sync',
      url: '/master/cloud-sync',
      icon: Cloud,
    },
    {
      title: t('common.help'),
      url: '/master/help',
      icon: HelpCircle,
    },
  ];

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex h-full flex-col ${mobile ? 'py-4' : ''}`}>
      <div className="px-4 py-6 border-b border-sidebar-border flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
          <img src={logoUrl} alt="Djati" className="h-full w-full object-contain" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-sidebar-foreground leading-tight uppercase tracking-tighter">
            Djati
          </h2>
          <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">{t('sidebar.dashboard')}</p>
        </div>
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
          <p className="text-sm text-sidebar-foreground/60 truncate px-3 mb-2">
            {user.email}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start mb-2"
          onClick={() => setIsPasswordDialogOpen(true)}
        >
          <KeyRound className="h-4 w-4 mr-2" />
          Change Password
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t('auth.signOut')}
        </Button>
        <div className="text-center mt-2">
          <p className="text-[10px] text-sidebar-foreground/40 font-mono">
            v{import.meta.env.VITE_APP_VERSION || 'dev'}
          </p>
        </div>
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
            <StoreMultiSelector />
            <HardwareStatus />
            <CurrencySwitcher />
            <LanguageSwitcher />
            <NotificationCenter />
          </div>
        </div>
        <Outlet />
        <ActivationDialog />
      </main>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}