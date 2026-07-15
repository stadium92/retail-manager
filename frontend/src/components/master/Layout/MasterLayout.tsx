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
  KeyRound,
  Wifi,
  WifiOff,
  Clock,
  ShieldAlert,
  CloudOff,
  AlertTriangle
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { LocalBridgeSyncService, type NetworkHealthStatus } from '@/services/LocalBridgeSyncService';
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
import { useDevice } from '@/contexts/DeviceContext';
import { MobileWorkerLayout } from '@/components/mobile/MobileWorkerLayout';

export function MasterLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { isDesktop } = useDevice();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthStatus>('ONLINE');
  const [networkMessage, setNetworkMessage] = useState('Connected to cloud');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const unsubscribeHealth = LocalBridgeSyncService.onHealthChange((status, message) => {
      setNetworkHealth(status);
      setNetworkMessage(message);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeHealth();
    };
  }, []);

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
      const { OfflineAuthService } = await import('@/services/OfflineAuthService');
      const result = await OfflineAuthService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (!result.success) {
        throw new Error(result.error || 'Password update failed');
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

  const navGroups = [
    {
      label: t('sidebar.groupOverview'),
      items: [
        { title: t('sidebar.dashboard'), url: '/master/dashboard', icon: LayoutDashboard },
        { title: t('sidebar.analytics'), url: '/master/analytics', icon: BarChart3 },
      ],
    },
    {
      label: t('sidebar.groupOperations'),
      items: [
        { title: t('sidebar.stores'), url: '/master/stores', icon: StoreIcon },
        { title: t('sidebar.inventory'), url: '/master/inventory', icon: Package },
        { title: t('sidebar.sales'), url: '/master/sales', icon: ShoppingCart },
        { title: t('sidebar.purchases'), url: '/master/purchases', icon: ShoppingBag },
        { title: t('menu.files.title') || 'Fichiers', url: '/master/files', icon: ScrollText },
      ],
    },
    {
      label: t('sidebar.groupLogistics'),
      items: [
        { title: t('sidebar.deliverers'), url: '/master/deliverers', icon: Truck },
        { title: t('sidebar.deliveries'), url: '/master/deliveries', icon: TruckIcon },
      ],
    },
    {
      label: t('sidebar.groupTeam'),
      items: [
        { title: t('sidebar.team'), url: '/master/team', icon: UsersRound },
        { title: t('sidebar.invitations'), url: '/master/invitations', icon: Mail },
      ],
    },
    {
      label: t('sidebar.groupSystem'),
      items: [
        { title: t('sidebar.systemLogs'), url: '/master/audit-logs', icon: ScrollText },
        { title: 'Cloud Sync', url: '/master/cloud-sync', icon: Cloud },
        { title: t('common.help'), url: '/master/help', icon: HelpCircle },
      ],
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

      <nav className="flex-1 space-y-4 p-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
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
            </div>
          </div>
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

  return !isDesktop ? (
    <MobileWorkerLayout />
  ) : (
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
            <div 
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-help transition-colors mr-auto',
                isOnline && networkHealth === 'ONLINE' 
                  ? 'bg-success/20 text-success-foreground' 
                  : networkHealth === 'CLOCK_SKEW' || networkHealth === 'FIREWALL_BLOCKED' || networkHealth === 'ISP_BLOCKED'
                    ? 'bg-danger/20 text-danger-foreground font-bold border border-danger/50 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'bg-warning/20 text-warning-foreground'
              )}
              title={!isOnline ? "No WiFi connection detected" : networkMessage}
            >
              {!isOnline ? (
                <><WifiOff className="h-3.5 w-3.5" /> <span className="font-medium hidden sm:inline">{t('common.offline')}</span></>
              ) : networkHealth === 'ONLINE' ? (
                <><Wifi className="h-3.5 w-3.5" /> <span className="font-medium hidden sm:inline">{t('common.online')}</span></>
              ) : networkHealth === 'CLOCK_SKEW' ? (
                <><Clock className="h-3.5 w-3.5" /> <span className="font-bold hidden sm:inline">Check Clock</span></>
              ) : networkHealth === 'FIREWALL_BLOCKED' ? (
                <><ShieldAlert className="h-3.5 w-3.5" /> <span className="font-bold hidden sm:inline">Firewall Blocked</span></>
              ) : networkHealth === 'ISP_BLOCKED' ? (
                <><CloudOff className="h-3.5 w-3.5" /> <span className="font-bold hidden sm:inline">ISP Blocked</span></>
              ) : networkHealth === 'RATE_LIMITED' ? (
                <><AlertTriangle className="h-3.5 w-3.5" /> <span className="font-bold hidden sm:inline">Rate Limited</span></>
              ) : (
                <><WifiOff className="h-3.5 w-3.5" /> <span className="font-medium hidden sm:inline">Cloud Unreachable</span></>
              )}
            </div>
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